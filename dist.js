"use strict";

var _regenerator = require("babel-runtime/regenerator");

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require("babel-runtime/helpers/asyncToGenerator");

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var unifi = require("node-unifi");
var Bluebird = require("bluebird");
var R = require("ramda");
var retry = require("bluebird-retry");

var Accessory = void 0,
    Service = void 0,
    Characteristic = void 0,
    UUIDGen = void 0;

module.exports = function (homebridge) {
  console.log("homebridge API version: " + homebridge.version);

  // Accessory must be created from PlatformAccessory Constructor
  Accessory = homebridge.platformAccessory;

  // Service and Characteristic are from hap-nodejs
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  // For platform plugin to be considered as dynamic platform plugin,
  // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
  homebridge.registerPlatform("homebridge-unifi-guest-wifi-platform", "UnifyGuestWifiPlatform", UnifyGuestWifiPlatform, true);
};

// Platform constructor
// config may be null
// api may be null if launched from old homebridge version
function UnifyGuestWifiPlatform(log, config, api) {
  var _this = this;

  log("UnifyGuestWifiPlatform Init");
  var platform = this;
  this.log = log;
  this.config = config;
  this.accessories = {};
  this.ready = false;

  this.controllerConfig = config.controller;

  this.unifiController = new unifi.Controller(this.controllerConfig.address, this.controllerConfig.port || 8443);

  Bluebird.promisifyAll(this.unifiController);

  if (api) {
    // Save the API object as plugin needs to register new accessory via this object
    this.api = api;

    // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories.
    // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
    // Or start discover new accessories.
    this.api.on("didFinishLaunching", function () {
      retry(function () {
        _this.log("Logging into Unifi Controller", _this.controllerConfig.address, _this.controllerConfig.port);
        return _this.unifiController.loginAsync(_this.controllerConfig.username, _this.controllerConfig.password).then(function () {
          _this.log("Logged into Unifi Controller");
          return _this.loadGuestWifi().then(function () {
            var interval = _this.controllerConfig.updateInterval || 10000;

            _this.log("Setting up update interval: " + interval);

            _this.updateInterval = setInterval(function () {
              _this.log("Updating Guest Wifi Controller");
              _this.loadGuestWifi();
            }, interval);

            platform.log("DidFinishLaunching");
          });
        }).catch(function (e) {
          _this.log("error loading guest wifies", e);
          throw e;
        });
      }, {
        interval: 6000,
        max_tries: 10,
        throw_original: true
      }).then(function () {
        _this.ready = true;
      });
    });
  }
}

UnifyGuestWifiPlatform.prototype.loadGuestWifi = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
  var sites, siteNames, wlans;
  return _regenerator2.default.wrap(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          this.log("loading guest wifies");
          _context.next = 3;
          return this.unifiController.getSitesAsync();

        case 3:
          sites = _context.sent;
          siteNames = sites.map(function (site) {
            return site.name;
          });
          _context.next = 7;
          return this.unifiController.getWLanSettingsAsync(siteNames);

        case 7:
          wlans = _context.sent;


          wlans = R.compose(R.filter(function (wlan) {
            return wlan.is_guest;
          }), R.flatten)(wlans);

          this.log("loaded wlan settings", wlans);

          if (!(wlans.length <= 0)) {
            _context.next = 12;
            break;
          }

          return _context.abrupt("return");

        case 12:

          this.log("loaded " + wlans.length + " wlans", wlans.map(function (wlan) {
            return wlan.name;
          }));

          _context.next = 15;
          return this.addGuestWifiAccessories(sites, wlans);

        case 15:
        case "end":
          return _context.stop();
      }
    }
  }, _callee, this);
}));

UnifyGuestWifiPlatform.prototype.addGuestWifiAccessories = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(sites, wlans) {
    var _this2 = this;

    var sitesBYId;
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            this.log("adding " + wlans.length + " guest wifi", sites);
            sitesBYId = R.indexBy(R.prop("_id"), sites);
            _context2.next = 4;
            return Bluebird.all(wlans.map(function (wlan) {
              var site = sitesBYId[wlan["site_id"]];

              return _this2.addGuestWifiAccessory(site, wlan);
            }));

          case 4:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));

  return function (_x, _x2) {
    return _ref2.apply(this, arguments);
  };
}();

UnifyGuestWifiPlatform.prototype.generateAccessoryName = function (site, wlan) {
  return site.name + "-" + wlan.name;
};

UnifyGuestWifiPlatform.prototype.generateAccessoryId = function (site, wlan) {
  return UUIDGen.generate(site._id + "-" + wlan._id);
};

UnifyGuestWifiPlatform.prototype.setupAccessory = function (accessory, configure) {
  var _this3 = this;

  var context = accessory.context;

  this.log("Setting up accessory for Guest Wifi: " + this.generateAccessoryName(context.site, context.wlan));

  accessory.on("identify", function (paired, callback) {
    _this3.log(newAccessory.displayName, "Identify!!!");
    callback();
  });
  // Plugin can save context on accessory to help restore accessory in configureAccessory()
  // newAccessory.context.something = "Something"

  // Make sure you provided a name for service, otherwise it may not visible in some HomeKit apps
  this.accessories[accessory.UUID] = accessory;

  this.log("getting service switch " + accessory.getService(Service.Switch) + ", " + configure);

  if (configure && !accessory.getService(Service.Switch)) {
    accessory.addService(Service.Switch, context.wlan.name);
  }

  accessory.getService(Service.Switch).getCharacteristic(Characteristic.On).on("set", function () {
    var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(value, callback) {
      var _accessory$context, site, wlan;

      return _regenerator2.default.wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              if (!_this3.ready) {
                callback(new Error("unifi controller is not ready yet."));
              }

              _accessory$context = accessory.context, site = _accessory$context.site, wlan = _accessory$context.wlan;

              _this3.log(accessory.displayName, "Guest Wifi -> " + _this3.generateAccessoryName(context.site, context.wlan) + ", " + value);

              _context3.next = 5;
              return _this3.unifiController.disableWLanAsync(site.name, wlan._id, !value);

            case 5:

              wlan.enabled = value;

              callback();

            case 7:
            case "end":
              return _context3.stop();
          }
        }
      }, _callee3, _this3);
    }));

    return function (_x3, _x4) {
      return _ref3.apply(this, arguments);
    };
  }()).on("get", function (callback) {
    if (!_this3.ready) {
      callback(new Error("unifi controller is not ready yet."));
    }

    var _accessory$context2 = accessory.context,
        site = _accessory$context2.site,
        wlan = _accessory$context2.wlan;

    _this3.log(accessory.displayName, "Guest Wifi -> " + _this3.generateAccessoryName(site, wlan) + ", " + wlan.enabled);
    callback(null, wlan.enabled);
  });
};

UnifyGuestWifiPlatform.prototype.addGuestWifiAccessory = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(site, wlan) {
    var name, uuid, newAccessory;
    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            name = this.generateAccessoryName(site, wlan);


            this.log("Adding Guest Wifi: " + name);

            uuid = this.generateAccessoryId(site, wlan);

            if (!this.accessories[uuid]) {
              _context4.next = 7;
              break;
            }

            this.log("Guest Wifi: " + name + ", exists, updating value instead");
            this.accessories[uuid].context = { site: site, wlan: wlan };
            return _context4.abrupt("return");

          case 7:

            this.log("Guest Wifi: " + name + ", does not exists, adding new accessory");

            newAccessory = new Accessory(name, uuid);


            newAccessory.context = {
              site: site,
              wlan: wlan
            };

            this.setupAccessory(newAccessory);

            this.registerAccessory(newAccessory);

          case 12:
          case "end":
            return _context4.stop();
        }
      }
    }, _callee4, this);
  }));

  return function (_x5, _x6) {
    return _ref4.apply(this, arguments);
  };
}();

UnifyGuestWifiPlatform.prototype.registerAccessory = function (accessory) {
  var _accessory$context3 = accessory.context,
      site = _accessory$context3.site,
      wlan = _accessory$context3.wlan;

  this.log("Registering accessory for Guest Wifi: " + this.generateAccessoryName(site, wlan));
  this.api.registerPlatformAccessories("homebridge-unifi-guest-wifi-platform", "UnifyGuestWifiPlatform", [accessory]);
};

// Function invoked when homebridge tries to restore cached accessory.
// Developer can configure accessory at here (like setup event handler).
// Update current value.
UnifyGuestWifiPlatform.prototype.configureAccessory = function (accessory) {
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

UnifyGuestWifiPlatform.prototype.updateAccessoriesReachability = function () {
  this.log("Update Reachability");
  for (var index in this.accessories) {
    var accessory = this.accessories[index];
    accessory.updateReachability(false);
  }
};

// Sample function to show how developer can remove accessory dynamically from outside event
UnifyGuestWifiPlatform.prototype.removeAccessory = function () {
  this.log("Remove Accessory");
  this.api.unregisterPlatformAccessories("homebridge-samplePlatform", "SamplePlatform", this.accessories);

  this.accessories = [];
};
