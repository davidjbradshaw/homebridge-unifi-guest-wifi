import Bluebird from "bluebird"
import retry from "bluebird-retry"
import unifi from "node-unifi"
import { compose, filter, flatten } from "ramda"

const SECOND = 1000
const DEFAULT_INTERVAL = 60 * SECOND
const DEFAULT_PORT = 443

let Accessory; let Service; let Characteristic; let UUIDGen

// Platform constructor
// config may be null
// api may be null if launched from old homebridge version
function UnifyGuestWifiPlatform(log, config, api) {
  log("UnifyGuestWifiPlatform Init")
  this.log = log
  this.config = config
  this.accessories = {}
  this.ready = false
  
  this.controllerConfig = config.controller
  
  this.unifiController = new unifi.Controller({
    host: this.controllerConfig.address,
    port: this.controllerConfig.port || DEFAULT_PORT,
    sslverify: this.controllerConfig.sslVerify || false,
  })
  
  // Bluebird.promisifyAll(this.unifiController)
  
  if (api) {
    // Save the API object as plugin needs to register new accessory via this object
    this.api = api
    
    // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories.
    // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
    // Or start discover new accessories.
    this.api.on("didFinishLaunching", () => {
      retry(
        () => {
          this.log(
            "Logging into Unifi Controller",
            this.controllerConfig.address,
            this.controllerConfig.port
          )
          return this.unifiController
            .login(
              this.controllerConfig.username,
              this.controllerConfig.password
            )
            .then(() => {
              this.log("Logged into Unifi Controller")
              return this.loadGuestWifi()
            })
            .then(() => {
              const interval = Number(this.controllerConfig.updateInterval) || DEFAULT_INTERVAL

              this.log(`Setting up update interval:`, interval, this.controllerConfig.updateInterval)
              
              this.updateInterval = setInterval(() => {
                this.log("Updating Guest Wifi Controller")
                this.loadGuestWifi()
              }, interval)
              
              this.log("DidFinishLaunching")
              return true
            })
            .catch(error => {
              this.log("error loading guest wifi", error)
              throw error
            })
          },
        {
          interval: 6000,
          max_tries: 10,
          throw_original: true
        }
      ).then(() => {
        this.ready = true
        return true
      }).catch(this.log)
    })
  }
}

UnifyGuestWifiPlatform.prototype.loadGuestWifi = async function() {
  // this.log("loading guest wifies")
  
  let wlans = await this.unifiController.getWLanSettings()
  
  wlans = compose(filter(wlan => wlan.is_guest), flatten)(wlans)
  
  // this.log("loaded wlan settings") // , wlans)
  
  if (wlans.length <= 0) {
    return
  }

  this.log(`loaded ${wlans.length} wlans`, wlans.map(wlan => wlan.name))
  
  await this.addGuestWifiAccessories(wlans)
}

UnifyGuestWifiPlatform.prototype.addGuestWifiAccessories = async function(
  wlans
) {
  // this.log(`adding ${wlans.length} guest wifi`)
  
  await Bluebird.all(
    wlans.map(wlan => this.addGuestWifiAccessory(wlan))
  )
}

UnifyGuestWifiPlatform.prototype.generateAccessoryName = (wlan) => wlan.name
  
UnifyGuestWifiPlatform.prototype.generateAccessoryId = (wlan) =>
  UUIDGen.generate(wlan._id)
  
UnifyGuestWifiPlatform.prototype.setupAccessory = function(
  accessory,
  configure
) {
  const {context, UUID} = accessory
  
  this.log(
    `Setting up accessory for Guest Wifi: ${this.generateAccessoryName(
      context.wlan
    )}`
  )
  
  accessory.on("identify", (paired, callback) => {
    // this.log(newAccessory.displayName, "Identify!!!")
    callback()
  })
  // Plugin can save context on accessory to help restore accessory in configureAccessory()
  // newAccessory.context.something = "Something"

  // Make sure you provided a name for service, otherwise it may not visible in some HomeKit apps
  this.accessories[UUID] = accessory
  
  this.log(
    `getting service switch ${accessory.getService(
      Service.Switch
    )}, ${configure}`
  )
  
  if (configure && !accessory.getService(Service.Switch)) {
    accessory.addService(Service.Switch, context.wlan.name)
  }

  accessory
    .getService(Service.Switch)
    .getCharacteristic(Characteristic.On)
    .on("set", async (value, callback) => {
      if (!this.ready) {
        callback(new Error("Set Failed: Unifi Controller is not ready yet."))
      }

      const { context: {wlan }, displayName } = accessory
    
      const wlanName = this.generateAccessoryName( wlan )

      this.log(`${displayName} requested ${value} id ${wlan._id.trim()}`)
      
      await this.unifiController.disableWLan(String(wlan._id), !value)
      
      wlan.enabled = value

      this.log(
        displayName,
        `Set Guest Wifi -> ${wlanName}, ${value}`
      )
      
      callback()
    })
    .on("get", callback => {
      if (!this.ready) {
        // this.log("unifi controller is not ready yet.")
        callback(new Error("Get Failed: unifi controller is not ready yet."))
        return
      }

      const { wlan } = accessory.context

      // this.log(
      //   accessory.displayName,
      //   `Get Guest Wifi -> ${this.generateAccessoryName(wlan)}, ${ 
      //     wlan.enabled}`
      // )
      
      callback(null, wlan.enabled)
    })
  }

UnifyGuestWifiPlatform.prototype.addGuestWifiAccessory = async function(
  wlan
) {
  const name = this.generateAccessoryName(wlan)
  
  this.log(`Adding Guest Wifi: ${name}`)
  
  const uuid = this.generateAccessoryId(wlan)
  
  if (this.accessories[uuid]) {
    this.log(`Guest Wifi: ${name}, exists, updating value instead`)
    this.accessories[uuid].context = { wlan }
    return
  }

  this.log(`Guest Wifi: ${name}, does not exists, adding new accessory`)
  
  const newAccessory = new Accessory(name, uuid)
  
  newAccessory.context = { wlan }
  
  this.setupAccessory(newAccessory, true)
  
  this.registerAccessory(newAccessory)
}

UnifyGuestWifiPlatform.prototype.registerAccessory = function(accessory) {
  const { wlan } = accessory.context
  this.log(
    `Registering accessory for Guest Wifi: ${this.generateAccessoryName(
      wlan
    )}`
  )
  this.api.registerPlatformAccessories(
    "homebridge-unifi-guest-wifi-platform",
    "UnifyGuestWifiPlatform",
    [accessory]
  )
}

// Function invoked when homebridge tries to restore cached accessory.
// Developer can configure accessory at here (like setup event handler).
// Update current value.
UnifyGuestWifiPlatform.prototype.configureAccessory = function(accessory) {
  this.log(accessory.displayName, "Configure Accessory") // , accessory)
  
  if (this.accessories[accessory.UUID]) {
    return
  }

  // Set the accessory to reachable if plugin can currently process the accessory,
  // otherwise set to false and update the reachability later by invoking
  // accessory.updateReachability()
  accessory.reachable = true // eslint-disable-line no-param-reassign
  
  this.setupAccessory(accessory, true)
}

UnifyGuestWifiPlatform.prototype.updateAccessoriesReachability = function() {
  // this.log("Update Reachability")
  // for (const index in this.accessories) {
  //   const accessory = this.accessories[index]
  //   accessory.updateReachability(false)
  // }
  Object.values(this.accessories).forEach(accessory => accessory.updateReachability(false))
}

// Sample function to show how developer can remove accessory dynamically from outside event
UnifyGuestWifiPlatform.prototype.removeAccessory = function() {
  this.log("Remove Accessory")
  this.api.unregisterPlatformAccessories(
    "homebridge-samplePlatform",
    "SamplePlatform",
    this.accessories
  )
  
  this.accessories = []
}


export default function unifiGuestWlan(homebridge) {
  // console.log(`homebridge API version: ${  homebridge.version}`)
  
  // Accessory must be created from PlatformAccessory Constructor
  Accessory = homebridge.platformAccessory
  
  // Service and Characteristic are from hap-nodejs
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  UUIDGen = homebridge.hap.uuid
  
  // For platform plugin to be considered as dynamic platform plugin,
  // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
  homebridge.registerPlatform(
    "homebridge-unifi-guest-wifi-platform",
    "UnifyGuestWifiPlatform",
    UnifyGuestWifiPlatform,
    true
  )
}
