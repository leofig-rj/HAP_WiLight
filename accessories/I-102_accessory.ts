import {
  Accessory,
  AccessoryEventTypes,
  Categories,
  Characteristic,
  CharacteristicEventTypes, CharacteristicSetCallback,
  CharacteristicValue,
  NodeCallback,
  Service,
  uuid,
  VoidCallback
} from '..';

var hostTCP = "#HOST#";
var portTCP = "#PORT#";
var numSerie = "#NUMSERIE#";
var mac = "#MAC#";
var hab1 = #HAB1#;
var hab2 = #HAB2#;
var hab3 = #HAB3#;
var modelo = "I-102";

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
// @ts-ignore
clientTCP.on('data', function(data) {
  var ret = "" + data;
  if(ret.substr(0, 16) === "&" + numSerie + "067") {
    WILIGHT.falhas = 0;
    // sinalizo retorno
    WILIGHT.retorno = true;
    // atualizo estados...
    if (hab1) {
      LIGHT_1.comanda = false;
      light1.setCharacteristic(Characteristic.On, (ret.substr(23, 1) === "1"));
      LIGHT_1.comanda = true;
    };
    if (hab2) {
      LIGHT_2.comanda = false;
      light2.setCharacteristic(Characteristic.On, (ret.substr(24, 1) === "1"));
      LIGHT_2.comanda = true;
    };
    if (hab3) {
      LIGHT_3.comanda = false;
      light3.setCharacteristic(Characteristic.On, (ret.substr(25, 1) === "1"));
      LIGHT_3.comanda = true;
    };
  };
});

const timeOut = 200; // 200 ms

// aqui o dispositivo que será exposto ao HomeKit
var arrayCmd: string[] = [];

var WILIGHT = {
  ativo: false,
  retorno: false,
  falhas: 0,
  falhasMAX: 5,
  pilhaCmd: arrayCmd,
  pilhaIni: 0,
  pilhaFim: 0,
  pilhaOcupado: false,
  timeoutPilha: setTimeout ( function() { WILIGHT.retiraDaPilha() }, timeOut ),

  conecta: function() {
    clientTCP.connect(portTCP, hostTCP, function() {});
      WILIGHT.pilhaIni = 0;
      WILIGHT.pilhaFim = 0;
      WILIGHT.pilhaOcupado = false;
      if (WILIGHT.pilhaCmd.length==0) {
        for (let i=0;i<10;i++) {
          WILIGHT.pilhaCmd.push("");
        }
      };
  },

  // @ts-ignore
  enviaComando: function(cmd) {
    WILIGHT.retorno = false;
    WILIGHT.falhas = WILIGHT.falhas + 1
    if (WILIGHT.ativo&&(!clientTCP.destroyed)) {
      WILIGHT.colocaNaPilha("!" + numSerie + cmd);
    } else {
      if ((!clientTCP.connecting)&&clientTCP.destroyed) {
        WILIGHT.conecta();
      };
    };
  },

  // @ts-ignore
  colocaNaPilha: function(cmd) {
    let pilhaVazia = false;
    if (WILIGHT.pilhaIni===WILIGHT.pilhaFim) pilhaVazia = true;
    let proxPilhaFim = WILIGHT.pilhaFim + 1;
    if (proxPilhaFim==10) proxPilhaFim = 0;
    if (proxPilhaFim===WILIGHT.pilhaIni) return; // ABORTO, pilha cheia
    WILIGHT.pilhaFim = proxPilhaFim;
    WILIGHT.pilhaCmd[WILIGHT.pilhaFim] = cmd;
    if (pilhaVazia) {
        WILIGHT.retiraDaPilha();
    } else {
      // Termino o TimeOut atual...
      clearTimeout(WILIGHT.timeoutPilha);
      // Gero novo timeOut
      WILIGHT.timeoutPilha = setTimeout ( function() { WILIGHT.retiraDaPilha() }, timeOut );
    }
  },

  retiraDaPilha: function() {
    if (!WILIGHT.ativo) return; // ABORTO, inativo
    if (WILIGHT.pilhaIni===WILIGHT.pilhaFim) return; // ABORTO, pilha vazia
    if (WILIGHT.pilhaOcupado) {
      // Termino o TimeOut atual...
      clearTimeout(WILIGHT.timeoutPilha);
      // Gero novo timeOut
      WILIGHT.timeoutPilha = setTimeout ( function() { WILIGHT.retiraDaPilha() }, timeOut );
      return;
    };
    WILIGHT.pilhaOcupado = true;
    let proxPilhaIni = WILIGHT.pilhaIni + 1;
    if (proxPilhaIni==10) proxPilhaIni = 0;
    WILIGHT.pilhaIni = proxPilhaIni;
    let cmd = WILIGHT.pilhaCmd[WILIGHT.pilhaIni];

    clientTCP.write(cmd, function(){
      WILIGHT.pilhaOcupado = false;
     if (WILIGHT.pilhaIni===WILIGHT.pilhaFim) return; // ABORTO, pilha vazia
       // Termino o TimeOut atual...
       clearTimeout(WILIGHT.timeoutPilha);
       // Gero novo timeOut
       WILIGHT.timeoutPilha = setTimeout ( function() { WILIGHT.retiraDaPilha() }, timeOut );
       return;
    });

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

  // @ts-ignore
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

// Aqui os itens do dispositivo expostos ao HomeKit
var LIGHT_1 = {
  comanda: true,
  powerOn: false,

  // @ts-ignore
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
  refresh: function() {
    // atualizo estado com ele mesmo...
    LIGHT_1.comanda = false;
    light1.setCharacteristic(Characteristic.On, LIGHT_1.powerOn);
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

  // @ts-ignore
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
  refresh: function() {
    // atualizo estado com eles mesmo...
    LIGHT_2.comanda = false;
    light2.setCharacteristic(Characteristic.On, LIGHT_2.powerOn);
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

  // @ts-ignore
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
  refresh: function() {
    // atualizo estado com ele mesmo...
    LIGHT_3.comanda = false;
    light3.setCharacteristic(Characteristic.On, LIGHT_3.powerOn);
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
var wlUUID = uuid.generate(aux);

// Este é o acessório que retornará para o HAP-NodeJS que representa o nosso WiLight.
var wlAccessory = exports.accessory = new Accessory("WiLight " + numSerie.substr(6), wlUUID);

// adicionamos propriedades para publicar usando Core.ts
// @ts-ignore
wlAccessory.username = mac;
// @ts-ignore
wlAccessory.pincode = "031-45-154";
// @ts-ignore
wlAccessory.category = Categories.SWITCH;

// definimos propriedades básicas
wlAccessory
 .getService(Service.AccessoryInformation)!
   .setCharacteristic(Characteristic.Manufacturer, "WiLight")
   .setCharacteristic(Characteristic.Model, modelo)
   .setCharacteristic(Characteristic.SerialNumber, numSerie);

// esperamos pelo evento "identify" para estes acessórios
wlAccessory.on(AccessoryEventTypes.IDENTIFY, (paired: boolean, callback: VoidCallback) => {
  if (hab1) {LIGHT_1.identify()};
  if (hab2) {LIGHT_2.identify()};
  if (hab3) {LIGHT_3.identify()};
  callback(); // success
});

// Adicionamos os serviços Switch e aguardamos por eventos de mudança do iOS.
var light1: Service;
var light2: Service;
var light3: Service;

if (hab1) {
  light1 = new Service.Switch("Lampada 1","1light");
  // @ts-ignore
  wlAccessory.addService(light1)
    .getCharacteristic(Characteristic.On)!
     .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
       LIGHT_1.setPowerOn(value);
       WILIGHT.aguardaRetorno(callback);
     })
     .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
       WILIGHT.solicitaDado();
       WILIGHT.aguardaRetorno(concluiGet);
       // @ts-ignore
       function concluiGet(err) {
         callback(err, LIGHT_1.powerOn);
       }
     });
};

if (hab2) {
  light2 = new Service.Switch("Lampada 2","2light");
  // @ts-ignore
  wlAccessory.addService(light2)
    .getCharacteristic(Characteristic.On)!
     .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
       LIGHT_2.setPowerOn(value);
       WILIGHT.aguardaRetorno(callback);
     })
     .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
       WILIGHT.solicitaDado();
       WILIGHT.aguardaRetorno(concluiGet);
       // @ts-ignore
       function concluiGet(err) {
         callback(err, LIGHT_2.powerOn);
       };
     });
};

if (hab3) {
  light3 = new Service.Switch("Lampada 3","3light");
  // @ts-ignore
  wlAccessory.addService(light3)
    .getCharacteristic(Characteristic.On)!
     .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
       LIGHT_3.setPowerOn(value);
       WILIGHT.aguardaRetorno(callback);
     })
     .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
       WILIGHT.solicitaDado();
       WILIGHT.aguardaRetorno(concluiGet);
       // @ts-ignore
       function concluiGet(err) {
         callback(err, LIGHT_3.powerOn);
       };
     });
};

// tentamos conectar...
WILIGHT.conecta();

// atualizamos estado a cada 10 segundos
setInterval(function() {
  WILIGHT.solicitaDado();
  WILIGHT.testaFalha();
}, 10000);
