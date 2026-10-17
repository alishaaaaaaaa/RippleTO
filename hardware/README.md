# Ripple TO control panel (Raspberry Pi Pico)

A physical "city decision console": a **knob** to move through time, a **safety-cover switch** to arm, and a **big red button** to enact the policy.

The Pico acts as a **USB keyboard**, so the app needs no drivers and works in any browser. **Unplug it and the laptop keyboard does exactly the same thing**, which makes the hardware fully removable.

| Control | Sends | App does |
|---|---|---|
| Turn knob → / ← | Right / Left arrow | Next / previous month |
| Press knob | Space | Play / pause |
| Flip safety cover + toggle **up** | A | Arm |
| Toggle **down** | D | Disarm |
| Big red button | E | Enact the policy (only works when armed) |

## Parts

- Raspberry Pi Pico H or Pico 2 H (pins pre-soldered). Buy 2 so you have a spare.
- KY-040 rotary encoder module with knob cap
- 60 mm arcade button
- Toggle switch with flip-up safety cover (2-pin SPST)
- Female-to-female jumper wires
- Micro-USB **data** cable
- A box (cardboard is fine), tape or hot glue

No breadboard or soldering needed.

## Wiring

Every part gets **one wire to a GP pin and one wire to a GND pin**. The Pico has 8 GND pins, so each part gets its own.

Pin numbers count from the USB end: pins 1–20 run down the left side (with the USB port at the top and the chip facing up), and 21–40 run back up the right side. Pins are also labelled on the underside of the board.


| Part | Wire 1 | Wire 2 |
|---|---|---|
| Big red button | GP15 (pin 20) | GND (pin 18) |
| Safety toggle | GP14 (pin 19) | GND (pin 23) |
| Encoder CLK | GP10 (pin 14) | |
| Encoder DT | GP11 (pin 15) | |
| Encoder SW | GP12 (pin 16) | |
| Encoder + | **3V3 rail** on the breadboard (see the screen section) or 3V3(OUT) pin 36 if there's no screen | |
| Encoder GND | GND (pin 13) | |

**Arcade button with 3 tabs?** Use the tabs marked **COM** and **NO** ("normally open").
**Arcade button tabs:** strip ~1 cm off one end of a jumper wire, wrap it tightly around the metal tab, then tape or hot-glue it.

## Optional: live screen (Grove LCD from the MLH booth)

The app can send the current period, the armed state and the headline number to a **Grove 16×2 RGB LCD** on the panel. The backlight changes colour too: **blue** for status quo, **red** when armed, **green** or **orange** after enacting (better or worse than the status quo).

This is a **bonus layer**: the buttons and knob work the same with or without it. If the screen isn't connected, it shows `SAFE` / `ARMED` straight from the switch.

**Extra parts from the booth:** Grove LCD (RGB backlight), a Grove-to-female jumper cable (or 4 female-to-male jumpers pushed into the Grove plug), a breadboard, and for the optional armed light, 1 LED plus 1 resistor (220–330 Ω).

### Wiring

The Pico has only **one** 3.3 V pin, and both the encoder and the screen need it, so run it to the breadboard's **+ rail** and power both from there.

| From | To |
|---|---|
| Pico **3V3(OUT)** (pin 36) | Breadboard **+** rail |
| Encoder **+** | Breadboard **+** rail |
| LCD **red** (VCC) | Breadboard **+** rail |
| LCD **black** (GND) | Pico **GND** (pin 3) |
| LCD **white** (SDA) | Pico **GP4** (pin 6) |
| LCD **yellow** (SCL) | Pico **GP5** (pin 7) |
| *(optional)* LED **long leg** | Pico **GP16** (pin 21) |
| *(optional)* LED **short leg** → resistor → | Pico **GND** (pin 28) |

Use **3V3, not VBUS (5 V)**, for the screen. The Pico's data pins aren't designed for 5 V.

### Connecting it in the app

1. Plug in the panel and open Ripple in **Chrome or Edge**.
2. Click **Connect panel** in the top bar. A list of serial devices pops up; pick the Pico (it's usually called **CircuitPython CDC** or something like `usbmodem…`) and click **Connect**.
3. The button turns green (**● Panel screen**) and the LCD switches to live data within a second.

Browsers require that click once each time the page loads. Do it before the judges arrive.

### Screen troubleshooting

| Problem | Fix |
|---|---|
| Screen stays blank and the serial console says `LCD disabled: No pull up found on SDA or SCL` | Add two resistors (4.7 kΩ–10 kΩ) from **GP4 → + rail** and **GP5 → + rail**. Some Grove boards don't include them. |
| Console says `LCD text chip (0x3E) not found` | SDA and SCL are swapped or loose. Check white → GP4 and yellow → GP5. |
| Backlight colour works but no letters | Old (v4) screens need 5 V for the text. Ask the hardware staff for a v5 screen, or skip the screen; everything else still works. |
| Shows `SAFE (no link)` while the app is open | Click **Connect panel** again and pick the other device in the list. |
| **Connect panel** button missing | You're not in Chrome or Edge. |

To see the console messages, open the Pico's serial console in [Mu Editor](https://codewith.mu/) or [Thonny](https://thonny.org/). **Close it before clicking Connect panel in the app**, because only one program can use the serial port at a time.

## Setup (15 minutes)

1. **Install CircuitPython.** Download the `.UF2` for your board from [circuitpython.org/board/raspberry_pi_pico](https://circuitpython.org/board/raspberry_pi_pico/) (or `raspberry_pi_pico2`). Hold the white **BOOTSEL** button while plugging in the Pico. A drive called `RPI-RP2` (`RP2350` on a Pico 2) appears; drag the `.UF2` onto it. The Pico reboots as a drive called **CIRCUITPY**.
   - If that drive never appears, your USB cable is charge-only. Try another cable.
2. **Add the keyboard library.** Download the **Adafruit CircuitPython Bundle** matching your CircuitPython version from [circuitpython.org/libraries](https://circuitpython.org/libraries). Unzip it and copy the **`adafruit_hid`** folder into `CIRCUITPY/lib/`.
3. **Copy the code.** Copy `hardware/code.py` from this repo onto the `CIRCUITPY` drive, replacing the existing `code.py`.
4. **Test without the app.** Open a text editor and click inside it. Press the big button and you should see `e`; flip the toggle for `a` / `d`. Turn the knob in a text field and the cursor moves. The Pico's onboard LED stays on while armed.
5. **Run Ripple** (`npm run dev`), open a scenario, and click once on the page so it has focus. Turn the knob, arm, and press the button.

## Troubleshooting

| Problem | Fix |
|---|---|
| Nothing happens | Click on the web page first; key presses go to whichever window has focus. |
| Knob goes the wrong way | Set `REVERSE_KNOB = True` in `code.py`. |
| Knob skips or double-steps | Normal for cheap encoders. Turn slower, or change `divisor` in `rotaryio.IncrementalEncoder(..., divisor=2)`. |
| Button fires twice | Check the wire is tight on the tab. `keypad` already debounces. |
| Toggle seems inverted | Your switch is wired normally-closed: swap to the other pin, or change `armed = event.pressed` to `armed = not event.pressed`. |
| See errors | Open the serial console in [Mu Editor](https://codewith.mu/) or [Thonny](https://thonny.org/) to see `print()` output. |

## Demo-day checklist

- [ ] Spare Pico flashed with the same `code.py`
- [ ] Tested on the presentation laptop
- [ ] Every control labelled on the box (KNOB = TIME, ARM, ENACT)
- [ ] Wire joints hot-glued or taped
- [ ] Clicked **Connect panel** before judging (if using the screen)
- [ ] Rehearsed without the panel too (keyboard), in case it fails
