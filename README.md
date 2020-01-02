# HAP_WiLight
WiLights accessories for HAP-NodeJS (https://github.com/KhaosT/HAP-NodeJS).

A project by Leonardo Figueiro (leoagfig@gmail.com)

# Introduction

This projecto intents to connect WiLights devices (www.wilight.com.br) to Apple Home Kit as accessories of HAP-NodeJS. WiLights are WiFi enabled devices that communicate with the HAP-NodeJS over the local LAN.
The information for creating the WiLights accessories examples was obtained in the HAP-NodeJS project. Thanks to Khaos Tian for the excellent work.

# How to use?

- Copy an accessory template based on your WiLight model to the HAP-NodeJS accessories folder and rename it as NNNNNNNNNNNN_accessory.ts, where NNNNNNNNNNNN is the serial number of your WiLight. For example: If you have a WiLight model I-001 with serial number 000000000345, you can copy the I-001_accessory.ts and rename it to 000000000345_accessory.ts.

- For all WiLight models, edit the created file, replacing:
  #HOST# by WiLight's IP. Ex.: 10.0.1.123,
  #NUMSERIE# by the WiLight's serial number (12 digits). Ex.: 0000000345 and
  #MAC# by WiLight's MAC. Ex.: 44:33:4C:B7:58:4A

- For WiLight model I-003 and I-102 edit the created file, replacing:
  #HAB1#, #HAB2# and #HAB3# by true or false depending on whether the lamps 1, 2 and 3 are enabled.

- For WiLight model D-003 and I-100, edit the created file, replacing:
  #HAB1#, #HAB2# and #HAB3# by true or false depending on whether the lamps 1, 2 and 3 are enabled.
  #DIM1#, #DIM1#, and #DIM1# by true or false according to DIMMER selection for lamps 1, 2, and 3.

- Before testing the accessories it is necessary to enable the open protocol in your WiLight, see WiLight documentation. It is important to note that the open protocol should only be enabled for use within your LAN if it has security enabled.
