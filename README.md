# Homebridge Unifi Guest Wifi

This plugin gives you an on/off switch for your Unifi Guest Wifi.

**Please note that when you turn a wifi network on or off in Unifi, it causes your APs to restart with the new settig. This means you will loose all your wifi networks for a few seconds, unless you have your Guest Network on it's own seporate AP.**

## Prerequisite

Make a **local account** for just this plugin on your [Unifi Controller](https://www.ui.com/download-software/).

## Example Config

```
{
  "bridge": {
    ... // homebridge configuration
  },
  "platforms": [
    {
      "platform" : "UnifyGuestWifiPlatform",
      "name" : "Guest Wifi Controller",
      "controller": {
         "username": "[your-guest-wifi-admin]", // your unifi controller username
         "password": "[your-strong-guest-wifi-admin-password]", //your unifi controller password
         "address": "192.168.1.1", // address to your unifi controller

         // Optionals with default values
         "port": 443, // port of your unifi controller
         "sslVerify": false // verify SSL cert
         "updateInterval": 60 // guest wifi update interval in seconds
      }
    }
  ]
}
```

*This project is an updated version of [homebridge-unifi-guest-wlan-switch](https://www.npmjs.com/package/homebridge-unifi-guest-wlan-switch) with the dependancies fixed to allow it to work on the current versions of the **Unifi Controller** and **HomeBridge**.*

*Due to the different way version 2 of [Node-Unifi](https://github.com/jens-maus/node-unifi) handles multiple sites, support for them has been removed and you will instead need a HomeBridge for each seporate site. Say hi if your the one person this change is going to effect, I would love to know what your use case is.*

*This code is far from great but it does seem to basically now work, maybe one day I will tidy it up some more and remove the need for it to poll the controller, or perhaps some nice person will make a PR to fix that. In the meantime enjoy using at your own risk, I didn't write this.*
