# HAP_WiLight
WiLights accessories for HAP-NodeJS (https://github.com/KhaosT/HAP-NodeJS).

A project by Leonardo Figueiro (leoagfig@gmail.com)

# Introduction

This projecto intents to connect WiLights devices (www.wilight.com.br) to Apple Home Kit as accessories of HAP-NodeJS. WiLights are WiFi enabled devices that communicate with the HAP-NodeJS over the local LAN.
The information for creating the WiLights accessories examples was obtained in the HAP-NodeJS project. Thanks to Khaos Tian for the excellent work.

# How to use?

- Copy an accessory template based on your WiLight model and rename it as NNNNNNNNNNNN_accessory.js, where NNNNNNNNNNNN is the serial number of your WiLight. For example: If you have a WiLight model I-001 with serial number 000000000345, you can copy the I-001_accessory.js and rename it to 000000000345_accessory.js.

- For all WiLight models, edit the created file, replacing:
  #HOST# by WiLight IP. Ex .: 10.0.1.123
  #NUMSERIE# by the WiLight serial number (12 digits). Ex .: 0000000345
  #MAC# by WiLight MAC. Ex: 44:33:4C:B7:58:4A


