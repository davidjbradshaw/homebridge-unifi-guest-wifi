# Homebridge Unifi Guest Wifi

This plugin let you control the Guest Wifi on your [Unifi Controller](https://www.ui.com/download-software/).

## Installation

`npm install -g homebridge-unifi-guest-wifi-switch`

## Prerequisite

Make a **local account** for just this plugin on your controller.

## Example Config

```
{
  "bridge": {
    ... // homebridge configuration
  },
  "platforms": [
    {
      "platform" : "UnifyGuestWifiPlatform",
      "name" : "Guest Controller",
      "controller": {
         "address": "192.168.1.1", // address to your unifi controller
         "port": 443, // port of your unifi controller
         "username": "your-guest-wifi-admin", // your unifi controller username
         "password": "yourguestwifiadminpassword", //your unifi controller password
         "updateInterval": 60000 // guest wifi update interval
      }
    }
  ]
}
```

*This project is an updated version of [homebridge-unifi-guest-wlan-switch](https://www.npmjs.com/package/homebridge-unifi-guest-wlan-switch) with the dependancies fixed to allow it to work on the current versions of the **Unifi Controller** and **HomeBridge**.*

*Due to the way [Node-Unifi](https://github.com/jens-maus/node-unifi) now handles multiple sites, support for this has been removed. You will need a HomeBridge for each site to deal with this, say hi if your the one person this change is going to effect.*

*When you turn a wifi network on or off, it causes your APs to restart with the new settigs, so you will loose all your wifi networks for a few seconds, unless you have your Guest Network on it's own seporate AP.*

*This code is far from great but it does seem to basically now work, maybe one day I will tidy it up some more and remove the need for it to poll the controller, or perhaps some nice person will make a PR to fix this. In the meantime enjoy using at your own risk, I didn't write this.*
