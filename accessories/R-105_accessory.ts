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
var modelo = "R-105";

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
  VALVULA.refresh();
  SWITCH_INIBE.refresh();
});

clientTCP.on('error', function() {
console.log('ERROR!!! ' + numSerie);
});

// onde atualizo estado...
// @ts-ignore
clientTCP.on('data', function(data) {
  var ret = '' + data;
  if(ret.substr(0, 16) === '&' + numSerie + "064") {
    WILIGHT.falhas = 0;
    // sinalizo retorno
    WILIGHT.retorno = true;
    // atualizo estados...
    // @ts-ignore
	  VALVULA.inUse = ~~(ret.substr(23, 1));
	  // O active da Válvula é igual ao inUse....
	  VALVULA.active = VALVULA.inUse;
    // @ts-ignore
    VALVULA.defaultDuration = ~~(ret.substr(25, 5));
    // @ts-ignore
    let tempoIrrigaAtual = ~~(ret.substr(35, 5));
	  VALVULA.remainingDuration = VALVULA.defaultDuration - tempoIrrigaAtual;

    VALVULA.comanda = false;
    valvula.setCharacteristic(Characteristic.Active, VALVULA.active);
    valvula.setCharacteristic(Characteristic.InUse, VALVULA.inUse);
    valvula.setCharacteristic(Characteristic.SetDuration, VALVULA.defaultDuration);
    valvula.setCharacteristic(Characteristic.RemainingDuration, VALVULA.remainingDuration);
    VALVULA.comanda = true;

    SWITCH_INIBE.comanda = false;
    switchInibe.setCharacteristic(Characteristic.On, SWITCH_INIBE.on);
    SWITCH_INIBE.comanda = true;

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
var VALVULA = {
  comanda: true,
  inUse: 0,
  active: 0,
  defaultDuration: 30,
  remainingDuration: 0,

  // @ts-ignore
  setInUse: function(val) {
    VALVULA.inUse = val;
	// inUse -> não faço nada, espero o resultado de active
  },
  // @ts-ignore
  setActive: function(val) {
    VALVULA.active = val;
	// active -> comando irrigação direto!
	// utilizo active e InUse juntos, no retorno pego o estado da irrigação e coloco nos dois...
    if (VALVULA.comanda) {
      if (val) {
        WILIGHT.enviaComando("001000");
      } else {
        WILIGHT.enviaComando("002000");
      };
    };
  },
  refresh: function() {
    // atualizo estado com eles mesmo...
    VALVULA.comanda = false;
    valvula.setCharacteristic(Characteristic.Active, VALVULA.active);
    valvula.setCharacteristic(Characteristic.InUse, VALVULA.inUse);
    valvula.setCharacteristic(Characteristic.SetDuration, VALVULA.defaultDuration);
    valvula.setCharacteristic(Characteristic.RemainingDuration, VALVULA.remainingDuration);
    VALVULA.comanda = true;
  },
  identify: function() {
    console.log("Identifica válvula!");
  }
}

var SWITCH_INIBE = {
  comanda: true,
  on: 0,

  // @ts-ignore
  setOn: function(val) {
    SWITCH_INIBE.on = val;
    if (SWITCH_INIBE.comanda) {
      if (val) {
        WILIGHT.enviaComando("003000");
      } else {
        WILIGHT.enviaComando("004000");
      };
    };
  },
  refresh: function() {
    // atualizo estado com eles mesmo...
    SWITCH_INIBE.comanda = false;
    switchInibe.setCharacteristic(Characteristic.On, SWITCH_INIBE.on);
    SWITCH_INIBE.comanda = true;
  },
  identify: function() {
    console.log("Identify the sprinkler switch!");
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
wlAccessory.category = Categories.SPRINKLER;

// definimos propriedades básicas
wlAccessory
 .getService(Service.AccessoryInformation)!
   .setCharacteristic(Characteristic.Manufacturer, "WiLight")
   .setCharacteristic(Characteristic.Model, modelo)
   .setCharacteristic(Characteristic.SerialNumber, numSerie);

// esperamos pelo evento "identify" para estes acessórios
wlAccessory.on(AccessoryEventTypes.IDENTIFY, (paired: boolean, callback: VoidCallback) => {
  VALVULA.identify();
  callback(); // success
});

// Adicionamos os serviços Valve (tipo "IRRIGATION/SPRINKLER") e Switch e aguardamos por eventos de mudança do iOS.
var valvula = new Service.Valve("Irrigação");
valvula.setCharacteristic(Characteristic.ValveType, "1"); // IRRIGATION/SPRINKLER = 1; SHOWER_HEAD = 2; WATER_FAUCET = 3;
// @ts-ignore
wlAccessory.addService(valvula);

valvula.getCharacteristic(Characteristic.Active)!
  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
    VALVULA.setActive(newValue);
    WILIGHT.aguardaRetorno(callback);
  })
  .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
    var err = null; // in case there were any problems
    WILIGHT.solicitaDado();
    WILIGHT.aguardaRetorno(concluiGet);
    // @ts-ignore
    function concluiGet(err) {
      callback(err, VALVULA.active);
    }
  });


valvula.getCharacteristic(Characteristic.InUse)!
  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
    VALVULA.setInUse(newValue);
    WILIGHT.aguardaRetorno(callback);
  })
  .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
    var err = null; // in case there were any problems
    WILIGHT.solicitaDado();
    WILIGHT.aguardaRetorno(concluiGet);
    // @ts-ignore
    function concluiGet(err) {
      callback(err, VALVULA.inUse);
    }
  });


valvula.getCharacteristic(Characteristic.RemainingDuration)!
  .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
    // @ts-ignore
    var err = null; // in case there were any problems
    if (VALVULA.inUse) {
      // @ts-ignore
      callback(err, VALVULA.remainingDuration);
    }
    else {
      // @ts-ignore
      callback(err, 0);
    }
  });

// #### Não estou usando SetDuration porque as opções do HomeKit começam com 5 minutos (muito!)
//valvula.getCharacteristic(Characteristic.SetDuration)!
//  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
//    console.log("SetDuration => NewValue: " + value);
//    VALVULA.defaultDuration = value;
//    callback();
//  });

// #### Tentei mudar maxValue, mas não deu certo...
//valvula.getCharacteristic(Characteristic.SetDuration)!
//  .setProps.maxValue=300;

// criamos o serviço switch para inibir a irrigação
var switchInibe = new Service.Switch("Inibe Irrigação")
// @ts-ignore
wlAccessory.addService(switchInibe);

switchInibe.getCharacteristic(Characteristic.On)!
  .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
    SWITCH_INIBE.setOn(value);
    WILIGHT.aguardaRetorno(callback);
  })
  .on(CharacteristicEventTypes.GET, (callback: NodeCallback<CharacteristicValue>) => {
    WILIGHT.solicitaDado();
    WILIGHT.aguardaRetorno(concluiGet);
    function concluiGet(err) {
      // @ts-ignore
      callback(err, SWITCH_INIBE.on);
    }
  });

// tentamos conectar...
WILIGHT.conecta();

// atualizamos estado a cada 10 segundos
setInterval(function() {
  WILIGHT.solicitaDado();
  WILIGHT.testaFalha();
}, 10000);
