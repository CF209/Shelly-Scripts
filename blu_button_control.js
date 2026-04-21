// BLU Button Touch → RGBW PM controller
// Replace with your BLU Button's MAC address (lowercase)
let BUTTON_MAC = "7c:c6:b6:9e:7b:42";

let BTHOME_SVC_ID_STR = "fcd2";
let lastPid = -1;

// --- Define what each press type does ---

function singlePush() {
  // Toggle light channel 2
  Shelly.call("Light.Toggle", { id: 2 });
}

function doublePush() {
  // Toggle light channel 0
  Shelly.call("Light.Toggle", { id: 0 });
}

function triplePush() {
  // Turn off all lights
  Shelly.call("Light.SetAll", { on: false, transition_duration: 0.5 });
}

function longPush() {
  // Add your action here
  Shelly.call("Light.SetAll", { on: true, brightness: 1, transition_duration: 1 });
}

// --- BTHome BLE decoder ---

let uint8 = 0, uint16 = 2, uint24 = 4, int16 = 3;

let BTH = {};
BTH[0x00] = { n: "pid",     t: uint8  };
BTH[0x01] = { n: "Battery", t: uint8  };
BTH[0x3a] = { n: "Button",  t: uint8  };

function getByteSize(type) {
  if (type === 0 || type === 1) return 1;
  if (type === 2 || type === 3) return 2;
  if (type === 4 || type === 5) return 3;
  return 1;
}

let Decoder = {
  getUInt8: function(b)  { return b.at(0); },
  getUInt16LE: function(b) { return 0xffff & ((b.at(1) << 8) | b.at(0)); },
  getBufValue: function(type, b) {
    if (type === uint8)  return this.getUInt8(b);
    if (type === uint16) return this.getUInt16LE(b);
    return null;
  },
  unpack: function(buffer) {
    let result = {};
    let i = 1; // skip first info byte
    while (i < buffer.length) {
      let id = buffer.at(i++);
      let def = BTH[id];
      if (!def) break;
      let sz = getByteSize(def.t);
      let val = this.getBufValue(def.t, buffer.slice(i, i + sz));
      result[def.n] = val;
      i += sz;
    }
    return result;
  }
};

// --- BLE scan callback ---

function bleScanCallback(event, result) {
  if (event !== BLE.Scanner.SCAN_RESULT) return;
  if (!result.service_data || !result.service_data[BTHOME_SVC_ID_STR]) return;

  // Filter by MAC address
  if (result.addr !== BUTTON_MAC) return;

  let parsed = Decoder.unpack(result.service_data[BTHOME_SVC_ID_STR]);
  if (!parsed) return;

  // Deduplicate packets (button fires multiple BLE packets per press)
  if (parsed.pid === lastPid) return;
  lastPid = parsed.pid;

  let btn = parsed.Button;
  print("BLU Button press detected, type:", btn);

  if (btn === 1) singlePush();
  else if (btn === 2) doublePush();
  else if (btn === 3) triplePush();
  else if (btn === 254) longPush();
}

// --- Start the scanner ---

let scanStarted = BLE.Scanner.Start({
  duration_ms: BLE.Scanner.INFINITE_SCAN,
  active: false
}, bleScanCallback);

if (scanStarted) {
  print("BLE scanner started successfully");
} else {
  print("BLE scanner failed to start - check Bluetooth is enabled in Settings");
}