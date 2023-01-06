# Homebridge Unifi Guest Wifi Switch

This plugin let you control your guest wifi from Unifi Controller.

## Installation

`npm install -g homebridge-unifi-guest-wifi-switch`

## Prerequisite

You need to have Unifi Controller accessible by the plugin.

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
         "address": "192.168.1.254", // address to your unifi controller
         "port": 443, // port of your unifi controller
         "username": "your-guest-wifi-admin", // your unifi controller username
         "password": "yourguestwifiadminpassword", //your unifi controller password
         "updateInterval": 60000 // guest wifi update interval
      }
    }
  ]
}
```

*This project is an updated version of [homebridge-unifi-guest-wlan-switch](https://www.npmjs.com/package/homebridge-unifi-guest-wlan-switch) with the dependancies fixed to allow it to work on the current version of HomeBridge.*
