var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var uuid = require('../').uuid;

var hostTCP = "#HOST#";
var portTCP = 46000;
var numSerie = "#NUMSERIE#";
var mac = "#MAC#";
var hab1 = #HAB1#;
var hab2 = #HAB2#;
var hab3 = #HAB3#;
var dim1 = #DIM1#;
var dim2 = #DIM2#;
var dim3 = #DIM3#;
var modelo = "D-003";

// TCP
var net = require('net');
var clientTCP = new net.Socket();

clientTCP.on('connect', function() {
  WILIGHT.ativo = true;
  WILIGHT.solicitaDado();
});

clientTCP.on('close', function() {
console.log('CLOSED!!! ' + numSerie);
  WILIGHT.ativo = false;
  if (hab1) {LIGHT_1.refresh()};
  if (hab2) {LIGHT_2.refresh()};
  if (hab3) {LIGHT_3.refresh()};
});

clientTCP.on('error', function() {
console.log('ERROR!!! ' + numSerie);
});

// onde atualizo estado...
clientTCP.on('data', function(data) {
  var ret = '' + data;
  WILIGHT.falhas = 0;
  if(ret.substr(0, 16) === '&' + numSerie + "068") {
    // sinalizo retorno
    WILIGHT.retorno = true;
    // atualizo estados...
    if (hab1) {
      var brightness1 = ~~(ret.substr(26, 3) * 100 / 255); // uso ~~para converter para inteiro!
      LIGHT_1.comanda = false;
      light1.setCharacteristic(Characteristic.On, (ret.substr(23, 1) === "1"));
      if (dim1) {
        light1.setCharacteristic(Characteristic.Brightness, brightness1);
      }
      LIGHT_1.comanda = true;
    };
    if (hab2) {
      var brightness2 = ~~(ret.substr(29, 3) * 100 / 255); // uso ~~para converter para inteiro!
      LIGHT_2.comanda = false;
      light2.setCharacteristic(Characteristic.On, (ret.substr(24, 1) === "1"));
      if (dim2) {
        light2.setCharacteristic(Characteristic.Brightness, brightness2);
      }
      LIGHT_2.comanda = true;
    };
    if (hab3) {
      var brightness3 = ~~(ret.substr(32, 3) * 100 / 255); // uso ~~para converter para inteiro!
      LIGHT_3.comanda = false;
      light3.setCharacteristic(Characteristic.On, (ret.substr(25, 1) === "1"));
      if (dim3) {
        light3.setCharacteristic(Characteristic.Brightness, brightness3);
      }
      LIGHT_3.comanda = true;
    };
  };
});

// aqui o dispositivo de hardware é exposto ao HomeKit
var WILIGHT = {
  ativo: false,
  retorno: false,
  falhas: 0,
  falhasMAX: 5,

  conecta: function() {
    clientTCP.connect(portTCP, hostTCP, function() {});
  },

  enviaComando: function(cmd) {
    WILIGHT.retorno = false;
    WILIGHT.falhas = WILIGHT.falhas + 1
    if (WILIGHT.ativo&&(!clientTCP.destroyed)) {
      clientTCP.write("!" + numSerie + cmd);
    } else {
      if ((!clientTCP.connecting)&&clientTCP.destroyed) {
        WILIGHT.conecta();
      };
    };
  },

  solicitaDado: function() {
    WILIGHT.enviaComando("000000");
  },

  testaFalha: function() {
    if (WILIGHT.falhas > WILIGHT.falhasMAX) {
      WILIGHT.falhas = 0;
      clientTCP.destroy(55);
    };
  },

  aguardaRetorno: function(callback) {
    // aguardo retorno...
    var page = 0;
    var last_page = 100;
    (function loop() {
      if (!WILIGHT.ativo) {
        callback(20);
      } else {
        if (WILIGHT.retorno) {
          callback();
        } else {
          if (page <= last_page) {
            // timeout de 20 ms, chamando recursivo...
            setTimeout(function() {
              page++;
              loop();
            }, 20);
          } else {
            callback(10);
          };
        };
      };
    }());
  }

}

// aqui os itens dos dispositivos de hardware são expostos ao HomeKit
var LIGHT_1 = {
  comanda: true,
  powerOn: false,
  brightness: 100, // percentage

  setPowerOn: function(on) {
    LIGHT_1.powerOn = on;
    if (LIGHT_1.comanda) {
        if (on) {
          WILIGHT.enviaComando("001000");
        } else {
          WILIGHT.enviaComando("002000");
       };
    };
  },
  setBrightness: function(brightness) {
    LIGHT_1.brightness = brightness;
    if (LIGHT_1.comanda) {
      var b = ~~(brightness * 255 / 100); // uso ~~para converter para inteiro!
      var cmd = "";
      if (b < 10) {
        cmd = "00" + b;
      } else {
        if (b < 100) {
          cmd = "0" + b;
        } else {
          cmd = "" + b;
        };
      };
      cmd = cmd + "0";
      WILIGHT.enviaComando("007004" + cmd);
    };
  },
  refresh: function() {
    // atualizo estado com ele mesmo...
    LIGHT_1.comanda = false;
    light1.setCharacteristic(Characteristic.On, LIGHT_1.powerOn);
    if (dim1) {
      light1.setCharacteristic(Characteristic.Brightness, LIGHT_1.brightness);
    }
    LIGHT_1.comanda = true;
  },
  identify: function() {
    var estado = LIGHT_1.powerOn;
    light1.setCharacteristic(Characteristic.On, !estado);
    setTimeout(function() {
      light1.setCharacteristic(Characteristic.On, estado);
    }, 2000);
  }
}

var LIGHT_2 = {
  comanda: true,
  powerOn: false,
  brightness: 100, // percentage

  setPowerOn: function(on) {
    LIGHT_2.powerOn = on;
    if (LIGHT_2.comanda) {
        if (on) {
          WILIGHT.enviaComando("003000");
        } else {
          WILIGHT.enviaComando("004000");
       };
    };
  },
  setBrightness: function(brightness) {
    LIGHT_2.brightness = brightness;
    if (LIGHT_2.comanda) {
      var b = ~~(brightness * 255 / 100); // uso ~~para converter para inteiro!
      var cmd = "";
      if (b < 10) {
        cmd = "00" + b;
      } else {
        if (b < 100) {
          cmd = "0" + b;
        } else {
          cmd = "" + b;
        };
      };
      cmd = cmd + "0";
      WILIGHT.enviaComando("008004" + cmd);
    };
  },
  refresh: function() {
    // atualizo estado com eles mesmo...
    LIGHT_2.comanda = false;
    light2.setCharacteristic(Characteristic.On, LIGHT_2.powerOn);
    if (dim2) {
      light2.setCharacteristic(Characteristic.Brightness, LIGHT_2.brightness);
    }
    LIGHT_2.comanda = true;
  },
  identify: function() {
    var estado = LIGHT_2.powerOn;
    light2.setCharacteristic(Characteristic.On, !estado);
    setTimeout(function() {
      light2.setCharacteristic(Characteristic.On, estado);
    }, 2000);
  }
}

var LIGHT_3 = {
  comanda: true,
  powerOn: false,
  brightness: 100, // percentage

  setPowerOn: function(on) {
    LIGHT_3.powerOn = on;
    if (LIGHT_3.comanda) {
        if (on) {
          WILIGHT.enviaComando("005000");
        } else {
          WILIGHT.enviaComando("006000");
       };
    };
  },
  setBrightness: function(brightness) {
    LIGHT_3.brightness = brightness;
    if (LIGHT_3.comanda) {
      var b = ~~(brightness * 255 / 100); // uso ~~para converter para inteiro!
      var cmd = "";
      if (b < 10) {
        cmd = "00" + b;
      } else {
        if (b < 100) {
          cmd = "0" + b;
        } else {
          cmd = "" + b;
        };
      };
      cmd = cmd + "0";
      WILIGHT.enviaComando("009004" + cmd);
    };
  },
  refresh: function() {
    // atualizo estado com ele mesmo...
    LIGHT_3.comanda = false;
    light3.setCharacteristic(Characteristic.On, LIGHT_3.powerOn);
    if (dim3) {
      light3.setCharacteristic(Characteristic.Brightness, LIGHT_3.brightness);
    }
    LIGHT_3.comanda = true;
  },
  identify: function() {
    var estado = LIGHT_3.powerOn;
    light3.setCharacteristic(Characteristic.On, !estado);
    setTimeout(function() {
      light3.setCharacteristic(Characteristic.On, estado);
    }, 2000);
  }
}

// Geramos um consistente UUID para nosso acessório WiLight que permanecerá o mesmo, mesmo
// que o servidor seja reiniciado.
var aux = "hap-nodejs:accessories:wilight:" + numSerie;
var lightUUID = uuid.generate(aux);

// Este é o acessório que retornará para o HAP-NodeJS que representa o nosso WiLight.
var light = exports.accessory = new Accessory("WiLight " + numSerie, lightUUID);

// adicionamos propriedades para publicar usando Core.js
light.username = mac;
light.pincode = "031-45-154";

// definimos propriedades básicas
light
  .getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, "WiLight")
  .setCharacteristic(Characteristic.Model, modelo)
  .setCharacteristic(Characteristic.SerialNumber, numSerie);

// esperamos pelo evento "identify" para estes acessórios
light.on('identify', function(paired, callback) {
  if (hab1) {LIGHT_1.identify()};
  if (hab2) {LIGHT_2.identify()};
  if (hab3) {LIGHT_3.identify()};
  callback(); // success
});

// Adicionamos os serviços Lightbulb e aguardamos por eventos de mudança do iOS.
var light1 = null;
var light2 = null;
var light3 = null;
if (hab1) {light1 = new Service.Lightbulb("Lampada 1","1light")};
if (hab2) {light2 = new Service.Lightbulb("Lampada 2","2light")};
if (hab3) {light3 = new Service.Lightbulb("Lampada 3","3light")};

if (hab1) {
  light.addService(light1);

  light1.getCharacteristic(Characteristic.On)
    .on('set', function(value, callback) {
      LIGHT_1.setPowerOn(value);
      WILIGHT.aguardaRetorno(callback);
    });

  light1.getCharacteristic(Characteristic.On)
    .on('get', function(callback) {
      WILIGHT.solicitaDado();
      WILIGHT.aguardaRetorno(concluiGet);
      function concluiGet(err) {
        callback(err, LIGHT_1.powerOn);
      }
    });

  if (dim1) {
    light1.addCharacteristic(Characteristic.Brightness)
      .on('get', function(callback) {
        WILIGHT.solicitaDado();
        WILIGHT.aguardaRetorno(concluiGet);
        function concluiGet(err) {
          callback(err, LIGHT_1.brightness);
        };
      })
      .on('set', function(value, callback) {
        LIGHT_1.setBrightness(value);
        WILIGHT.aguardaRetorno(callback);
      });
  };
};

if (hab2) {
  light.addService(light2);

  light2.getCharacteristic(Characteristic.On)
    .on('set', function(value, callback) {
      LIGHT_2.setPowerOn(value);
      WILIGHT.aguardaRetorno(callback);
    });

  light2.getCharacteristic(Characteristic.On)
    .on('get', function(callback) {
      WILIGHT.solicitaDado();
      WILIGHT.aguardaRetorno(concluiGet);
      function concluiGet(err) {
        callback(err, LIGHT_2.powerOn);
      };
    });

  if (dim2) {
    light2.addCharacteristic(Characteristic.Brightness)
      .on('get', function(callback) {
        WILIGHT.solicitaDado();
        WILIGHT.aguardaRetorno(concluiGet);
        function concluiGet(err) {
          callback(err, LIGHT_2.brightness);
        };
      })
      .on('set', function(value, callback) {
        LIGHT_2.setBrightness(value);
        WILIGHT.aguardaRetorno(callback);
      });
  };
};

if (hab3) {
  light.addService(light3);

  light3.getCharacteristic(Characteristic.On)
    .on('set', function(value, callback) {
      LIGHT_3.setPowerOn(value);
      WILIGHT.aguardaRetorno(callback);
    });

  light3.getCharacteristic(Characteristic.On)
    .on('get', function(callback) {
      WILIGHT.solicitaDado();
      WILIGHT.aguardaRetorno(concluiGet);
      function concluiGet(err) {
        callback(err, LIGHT_3.powerOn);
      };
    });

  if (dim3) {
    light3.addCharacteristic(Characteristic.Brightness)
      .on('get', function(callback) {
        WILIGHT.solicitaDado();
        WILIGHT.aguardaRetorno(concluiGet);
        function concluiGet(err) {
          callback(err, LIGHT_3.brightness);
        };
      })
      .on('set', function(value, callback) {
        LIGHT_3.setBrightness(value);
        WILIGHT.aguardaRetorno(callback);
      });
  };
};

// tentamos conectar...
WILIGHT.conecta();

// atualizamos estado a cada 30 segundos
setInterval(function() {
  WILIGHT.solicitaDado();
  WILIGHT.testaFalha();
}, 30000);
