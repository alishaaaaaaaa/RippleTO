# ─────────────────────────────────────────────────────────────────────────────
# Ripple TO — control panel firmware (CircuitPython, Raspberry Pi Pico / Pico 2)
#
# The Pico pretends to be a USB keyboard. The web app only listens for normal
# key presses, so:
#   • no drivers, no Web Serial, works in any browser
#   • unplug the panel and the laptop keyboard does exactly the same thing
#
# Control            → key sent         → what the app does
# Knob turn right    → Right arrow      → next month / period
# Knob turn left     → Left arrow       → previous period
# Knob press         → Space            → play / pause
# Safety toggle UP   → A                → arm
# Safety toggle DOWN → D                → disarm
# Big red button     → E                → enact the policy (only if armed)
#
# Wiring (every part: one wire to a GP pin, one wire to a GND pin):
#   Big red button   : GP15 (pin 20)  + GND (pin 18)
#   Safety toggle    : GP14 (pin 19)  + GND (pin 23)
#   Encoder CLK      : GP10 (pin 14)
#   Encoder DT       : GP11 (pin 15)
#   Encoder SW       : GP12 (pin 16)
#   Encoder +        : 3V3(OUT) (pin 36)   ← NOT VBUS/5V
#   Encoder GND      : GND (pin 13)
#
# Needs one library from the Adafruit CircuitPython Bundle: the `adafruit_hid`
# folder, copied into the CIRCUITPY drive's `lib/` folder. See hardware/README.md.
# ─────────────────────────────────────────────────────────────────────────────

import time
import board
import digitalio
import keypad
import rotaryio
import usb_hid
from adafruit_hid.keyboard import Keyboard
from adafruit_hid.keycode import Keycode

# ── Pins (change here if you wire differently) ──────────────────────────────
PIN_BUTTON = board.GP15
PIN_TOGGLE = board.GP14
PIN_ENC_A = board.GP10  # CLK
PIN_ENC_B = board.GP11  # DT
PIN_ENC_SW = board.GP12  # SW

# If the knob feels backwards, flip this.
REVERSE_KNOB = False

# ── Setup ───────────────────────────────────────────────────────────────────
kbd = None
for _ in range(20):  # the computer may take a moment to accept the keyboard
    try:
        kbd = Keyboard(usb_hid.devices)
        break
    except OSError:
        time.sleep(0.5)

led = digitalio.DigitalInOut(board.LED)
led.direction = digitalio.Direction.OUTPUT

# keypad handles debouncing for us. value_when_pressed=False + pull=True means
# "pressed" = the switch connects the pin to GND (internal pull-up enabled).
keys = keypad.Keys(
    (PIN_BUTTON, PIN_TOGGLE, PIN_ENC_SW),
    value_when_pressed=False,
    pull=True,
)
KEY_BUTTON, KEY_TOGGLE, KEY_KNOB = 0, 1, 2

encoder = rotaryio.IncrementalEncoder(PIN_ENC_A, PIN_ENC_B)
last_position = encoder.position

armed = False


def tap(*keycodes):
    """Press and release a key (or combo). Blink the onboard LED as feedback."""
    if kbd is None:
        return
    try:
        kbd.send(*keycodes)
    except OSError:
        pass  # computer asleep / unplugged mid-press — just skip
    led.value = not led.value
    time.sleep(0.02)
    led.value = armed


# Give the computer a moment to finish setting up the keyboard.
# keypad starts by assuming every switch is released, so if the safety toggle
# is already UP at startup, the first scan reports it as "pressed" and we send
# A — the screen automatically matches the physical switch.
time.sleep(1.0)
print("Ripple panel ready.")

# ── Main loop ───────────────────────────────────────────────────────────────
while True:
    # Buttons and switch
    event = keys.events.get()
    while event:
        if event.key_number == KEY_BUTTON and event.pressed:
            tap(Keycode.E)
        elif event.key_number == KEY_TOGGLE:
            armed = event.pressed  # switch closed = armed
            tap(Keycode.A if armed else Keycode.D)
        elif event.key_number == KEY_KNOB and event.pressed:
            tap(Keycode.SPACE)
        event = keys.events.get()

    # Knob
    position = encoder.position
    if position != last_position:
        steps = position - last_position
        if REVERSE_KNOB:
            steps = -steps
        key = Keycode.RIGHT_ARROW if steps > 0 else Keycode.LEFT_ARROW
        for _ in range(min(abs(steps), 3)):  # cap fast spins so it stays controllable
            tap(key)
        last_position = position

    led.value = armed
    time.sleep(0.005)
