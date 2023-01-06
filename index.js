const unifi = require("node-unifi");
const Bluebird = require("bluebird");
const R = require("ramda");
const retry = require("bluebird-retry");

let Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {
  console.log("homebridge API version: " + homebridge.version);

  // Accessory must be created from PlatformAccessory Constructor
  Accessory = homebridge.platformAccessory;

  // Service and Characteristic are from hap-nodejs
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  // For platform plugin to be considered as dynamic platform plugin,
  // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
  homebridge.registerPlatform(
    "homebridge-unifi-guest-wifi-platform",
    "UnifyGuestWifiPlatform",
    UnifyGuestWifiPlatform,
    true
  );
};

// Platform constructor
// config may be null
// api may be null if launched from old homebridge version
function UnifyGuestWifiPlatform(log, config, api) {
  log("UnifyGuestWifiPlatform Init");
  var platform = this;
  this.log = log;
  this.config = config;
  this.accessories = {};
  this.ready = false;

  this.controllerConfig = config.controller;

  this.unifiController = new unifi.Controller(
    this.controllerConfig.address,
    this.controllerConfig.port || 8443
  );

  Bluebird.promisifyAll(this.unifiController);

  if (api) {
    // Save the API object as plugin needs to register new accessory via this object
    this.api = api;

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
          );
          return this.unifiController
            .loginAsync(
              this.controllerConfig.username,
              this.controllerConfig.password
            )
            .then(() => {
              this.log("Logged into Unifi Controller");
              return this.loadGuestWifi().then(() => {
                const interval = this.controllerConfig.updateInterval || 10000;

                this.log(`Setting up update interval: ${interval}`);

                this.updateInterval = setInterval(() => {
                  this.log("Updating Guest Wifi Controller");
                  this.loadGuestWifi();
                }, interval);

                platform.log("DidFinishLaunching");
              });
            })
            .catch(e => {
              this.log("error loading guest wifies", e);
              throw e;
            });
        },
        {
          interval: 6000,
          max_tries: 10,
          throw_original: true
        }
      ).then(() => {
        this.ready = true;
      });
    });
  }
}

UnifyGuestWifiPlatform.prototype.loadGuestWifi = async function() {
  this.log("loading guest wifies");
  const sites = await this.unifiController.getSitesAsync();

  const siteNames = sites.map(site => site.name);

  let wlans = await this.unifiController.getWLanSettingsAsync(siteNames);

  wlans = R.compose(R.filter(wlan => wlan.is_guest), R.flatten)(wlans);

  this.log("loaded wlan settings", wlans);

  if (wlans.length <= 0) {
    return;
  }

  this.log(`loaded ${wlans.length} wlans`, wlans.map(wlan => wlan.name));

  await this.addGuestWifiAccessories(sites, wlans);
};

UnifyGuestWifiPlatform.prototype.addGuestWifiAccessories = async function(
  sites,
  wlans
) {
  this.log(`adding ${wlans.length} guest wifi`, sites);
  const sitesBYId = R.indexBy(R.prop("_id"), sites);

  await Bluebird.all(
    wlans.map(wlan => {
      const site = sitesBYId[wlan["site_id"]];

      return this.addGuestWifiAccessory(site, wlan);
    })
  );
};

UnifyGuestWifiPlatform.prototype.generateAccessoryName = (site, wlan) =>
  `${site.name}-${wlan.name}`;

UnifyGuestWifiPlatform.prototype.generateAccessoryId = (site, wlan) =>
  UUIDGen.generate(`${site._id}-${wlan._id}`);

UnifyGuestWifiPlatform.prototype.setupAccessory = function(
  accessory,
  configure
) {
  const context = accessory.context;

  this.log(
    `Setting up accessory for Guest Wifi: ${this.generateAccessoryName(
      context.site,
      context.wlan
    )}`
  );

  accessory.on("identify", (paired, callback) => {
    this.log(newAccessory.displayName, "Identify!!!");
    callback();
  });
  // Plugin can save context on accessory to help restore accessory in configureAccessory()
  // newAccessory.context.something = "Something"

  // Make sure you provided a name for service, otherwise it may not visible in some HomeKit apps
  this.accessories[accessory.UUID] = accessory;

  this.log(
    `getting service switch ${accessory.getService(
      Service.Switch
    )}, ${configure}`
  );

  if (configure && !accessory.getService(Service.Switch)) {
    accessory.addService(Service.Switch, context.wlan.name);
  }

  accessory
    .getService(Service.Switch)
    .getCharacteristic(Characteristic.On)
    .on("set", async (value, callback) => {
      if (!this.ready) {
        callback(new Error("unifi controller is not ready yet."));
      }

      const { site, wlan } = accessory.context;
      this.log(
        accessory.displayName,
        `Guest Wifi -> ${this.generateAccessoryName(
          context.site,
          context.wlan
        )}, ` + value
      );

      await this.unifiController.disableWLanAsync(site.name, wlan._id, !value);

      wlan.enabled = value;

      callback();
    })
    .on("get", callback => {
      if (!this.ready) {
        callback(new Error("unifi controller is not ready yet."));
      }

      const { site, wlan } = accessory.context;
      this.log(
        accessory.displayName,
        `Guest Wifi -> ${this.generateAccessoryName(site, wlan)}, ` +
          wlan.enabled
      );
      callback(null, wlan.enabled);
    });
};

UnifyGuestWifiPlatform.prototype.addGuestWifiAccessory = async function(
  site,
  wlan
) {
  const name = this.generateAccessoryName(site, wlan);

  this.log(`Adding Guest Wifi: ${name}`);

  const uuid = this.generateAccessoryId(site, wlan);

  if (this.accessories[uuid]) {
    this.log(`Guest Wifi: ${name}, exists, updating value instead`);
    this.accessories[uuid].context = { site, wlan };
    return;
  }

  this.log(`Guest Wifi: ${name}, does not exists, adding new accessory`);

  var newAccessory = new Accessory(name, uuid);

  newAccessory.context = {
    site,
    wlan
  };

  this.setupAccessory(newAccessory, true);

  this.registerAccessory(newAccessory);
};

UnifyGuestWifiPlatform.prototype.registerAccessory = function(accessory) {
  const { site, wlan } = accessory.context;
  this.log(
    `Registering accessory for Guest Wifi: ${this.generateAccessoryName(
      site,
      wlan
    )}`
  );
  this.api.registerPlatformAccessories(
    "homebridge-unifi-guest-wifi-platform",
    "UnifyGuestWifiPlatform",
    [accessory]
  );
};

// Function invoked when homebridge tries to restore cached accessory.
// Developer can configure accessory at here (like setup event handler).
// Update current value.
UnifyGuestWifiPlatform.prototype.configureAccessory = function(accessory) {
  this.log(accessory.displayName, "Configure Accessory", accessory);

  if (this.accessories[accessory.UUID]) {
    return;
  }

  // Set the accessory to reachable if plugin can currently process the accessory,
  // otherwise set to false and update the reachability later by invoking
  // accessory.updateReachability()
  accessory.reachable = true;

  this.setupAccessory(accessory, true);
};

UnifyGuestWifiPlatform.prototype.updateAccessoriesReachability = function() {
  this.log("Update Reachability");
  for (var index in this.accessories) {
    var accessory = this.accessories[index];
    accessory.updateReachability(false);
  }
};

// Sample function to show how developer can remove accessory dynamically from outside event
UnifyGuestWifiPlatform.prototype.removeAccessory = function() {
  this.log("Remove Accessory");
  this.api.unregisterPlatformAccessories(
    "homebridge-samplePlatform",
    "SamplePlatform",
    this.accessories
  );

  this.accessories = [];
};
