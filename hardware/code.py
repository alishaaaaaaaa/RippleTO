# ─────────────────────────────────────────────────────────────────────────────
# Ripple TO — control panel firmware (CircuitPython, Raspberry Pi Pico / Pico 2)
#
# TWO DIRECTIONS, INDEPENDENT ON PURPOSE:
#
# 1) Panel → app (always on): the Pico acts as a USB keyboard.
#      Knob turn right / left → Right / Left arrow → next / previous period
#      Knob press             → Space             → play / pause
#      Safety toggle UP / DOWN→ A / D             → arm / disarm
#      Big red button         → E                 → enact the policy
#
# 2) App → panel (optional): the app sends one text line over USB serial
#    after you click "Connect panel" in the app (Chrome/Edge). The Pico shows
#    it on a Grove 16x2 RGB LCD:  S|<line 1>|<line 2>|<r>,<g>,<b>
#    If there's no screen, or no app link, or the link drops, the screen
#    falls back to showing SAFE / ARMED from the switch, and part 1 keeps
#    working exactly the same.
#
# Wiring (see hardware/README.md for the full guide):
#   Big red button : GP15 (pin 20) + GND (pin 18)
#   Safety toggle  : GP14 (pin 19) + GND (pin 23)
#   Encoder        : CLK GP10 (pin 14), DT GP11 (pin 15), SW GP12 (pin 16),
#                    + → 3V3 rail, GND → GND (pin 13)
#   Grove LCD      : SDA (white) GP4 (pin 6), SCL (yellow) GP5 (pin 7),
#                    VCC (red) → 3V3 rail, GND (black) → GND (pin 3)
#   Armed light    : (optional) LED long leg → GP16 (pin 21),
#                    short leg → 220–330 Ω resistor → GND (pin 28)
#   3V3 rail       : Pico 3V3(OUT) (pin 36) → breadboard + rail, so the
#                    encoder and LCD can share it.
#
# Library needed: the `adafruit_hid` folder from the Adafruit CircuitPython
# Bundle, copied into CIRCUITPY/lib/. The LCD driver is built in below.
# ─────────────────────────────────────────────────────────────────────────────

import sys
import time
import board
import busio
import digitalio
import keypad
import rotaryio
import supervisor
import usb_hid
from adafruit_hid.keyboard import Keyboard
from adafruit_hid.keycode import Keycode

# ── Pins (change here if you wire differently) ──────────────────────────────
PIN_BUTTON = board.GP15
PIN_TOGGLE = board.GP14
PIN_ENC_A = board.GP10  # CLK
PIN_ENC_B = board.GP11  # DT
PIN_ENC_SW = board.GP12  # SW
PIN_SDA = board.GP4
PIN_SCL = board.GP5
PIN_ARMED_LIGHT = board.GP16

REVERSE_KNOB = False  # flip if the knob feels backwards
LINK_TIMEOUT_S = 8  # no message from the app for this long → local fallback


# ── Grove 16x2 RGB LCD driver (no extra library needed) ─────────────────────
class GroveLCD:
    """Seeed Grove LCD RGB Backlight. Text chip at 0x3E; backlight at 0x62 (v4) or 0x30 (v5)."""

    TEXT = 0x3E

    def __init__(self, i2c):
        self.i2c = i2c
        found = self._scan()
        print("I2C devices found:", [hex(a) for a in found])
        if self.TEXT not in found:
            raise RuntimeError("LCD text chip (0x3E) not found")
        self.rgb = 0x30 if 0x30 in found else (0x62 if 0x62 in found else None)
        time.sleep(0.05)
        for c in (0x28, 0x28, 0x0C, 0x01, 0x06):  # 2 lines, display on, clear, left-to-right
            self._cmd(c)
            time.sleep(0.005)
        if self.rgb == 0x30:  # v5 backlight chip
            self._reg(0x00, 0x07)
            time.sleep(0.001)
            self._reg(0x04, 0x15)
        elif self.rgb == 0x62:  # v4 backlight chip
            self._reg(0x00, 0x00)
            self._reg(0x08, 0xFF)
            self._reg(0x01, 0x20)
        self._shown = None
        self._colour = None

    def _scan(self):
        while not self.i2c.try_lock():
            pass
        try:
            return self.i2c.scan()
        finally:
            self.i2c.unlock()

    def _write(self, addr, data):
        while not self.i2c.try_lock():
            pass
        try:
            self.i2c.writeto(addr, bytes(data))
        finally:
            self.i2c.unlock()

    def _cmd(self, c):
        self._write(self.TEXT, (0x80, c))

    def _reg(self, reg, val):
        if self.rgb is not None:
            self._write(self.rgb, (reg, val))

    def show(self, line1, line2):
        lines = (line1[:16] + " " * 16)[:16], (line2[:16] + " " * 16)[:16]
        if lines == self._shown:
            return  # unchanged — avoid flicker
        for row, text in enumerate(lines):
            self._cmd(0x80 if row == 0 else 0xC0)  # move cursor to start of row
            for ch in text:
                self._write(self.TEXT, (0x40, ord(ch) if 32 <= ord(ch) < 127 else 32))
        self._shown = lines

    def colour(self, r, g, b):
        rgb = (r, g, b)
        if rgb == self._colour or self.rgb is None:
            return
        if self.rgb == 0x30:
            self._reg(0x06, r)
            self._reg(0x07, g)
            self._reg(0x08, b)
        else:
            self._reg(0x04, r)
            self._reg(0x03, g)
            self._reg(0x02, b)
        self._colour = rgb


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

armed_light = None
try:
    armed_light = digitalio.DigitalInOut(PIN_ARMED_LIGHT)
    armed_light.direction = digitalio.Direction.OUTPUT
except Exception as e:  # optional part — ignore if the pin is busy
    print("Armed light disabled:", e)

lcd = None
try:
    lcd = GroveLCD(busio.I2C(PIN_SCL, PIN_SDA, frequency=100_000))
    lcd.colour(40, 90, 255)
    lcd.show("RIPPLE TO PANEL", "starting...")
except Exception as e:  # no screen, wrong wiring, missing pull-ups → run without it
    print("LCD disabled:", e)
    lcd = None

# keypad debounces for us. "pressed" = the switch connects the pin to GND.
keys = keypad.Keys((PIN_BUTTON, PIN_TOGGLE, PIN_ENC_SW), value_when_pressed=False, pull=True)
KEY_BUTTON, KEY_TOGGLE, KEY_KNOB = 0, 1, 2

encoder = rotaryio.IncrementalEncoder(PIN_ENC_A, PIN_ENC_B)
last_position = encoder.position

armed = False
serial_buf = ""
last_msg_at = -1000.0  # time of the last message from the app


def tap(*keycodes):
    """Press and release a key. Blink the onboard LED as feedback."""
    if kbd is None:
        return
    try:
        kbd.send(*keycodes)
    except OSError:
        pass  # computer asleep / unplugged — skip
    led.value = not led.value
    time.sleep(0.02)
    led.value = armed


def show_local():
    """What the screen shows when the app isn't connected."""
    if lcd is None:
        return
    try:
        lcd.colour(*((255, 0, 0) if armed else (40, 90, 255)))
        lcd.show("RIPPLE TO", "ARMED - press E" if armed else "SAFE  (no link)")
    except Exception as e:
        print("LCD error:", e)


def read_app_messages():
    """Read lines the app sent over USB serial; apply the newest valid one."""
    global serial_buf, last_msg_at
    n = supervisor.runtime.serial_bytes_available
    if not n:
        return
    serial_buf += sys.stdin.read(n)
    if len(serial_buf) > 512:
        serial_buf = serial_buf[-256:]  # never let junk pile up
    while "\n" in serial_buf:
        line, serial_buf = serial_buf.split("\n", 1)
        parts = line.strip().split("|")
        if len(parts) != 4 or parts[0] != "S":
            continue
        last_msg_at = time.monotonic()
        if lcd is None:
            continue
        try:
            r, g, b = (max(0, min(255, int(x))) for x in parts[3].split(","))
            lcd.colour(r, g, b)
            lcd.show(parts[1], parts[2])
        except Exception as e:
            print("Bad message or LCD error:", e)


# Give the computer a moment to finish setting up the keyboard. keypad starts
# by assuming every switch is released, so if the toggle is already UP, the
# first scan reports it "pressed" and sends A — the app matches the switch.
time.sleep(1.0)
show_local()
print("Ripple panel ready.")

# ── Main loop ───────────────────────────────────────────────────────────────
linked = False
while True:
    event = keys.events.get()
    while event:
        if event.key_number == KEY_BUTTON and event.pressed:
            tap(Keycode.E)
        elif event.key_number == KEY_TOGGLE:
            armed = event.pressed  # switch closed = armed
            tap(Keycode.A if armed else Keycode.D)
            if not linked:
                show_local()  # instant feedback even without the app
        elif event.key_number == KEY_KNOB and event.pressed:
            tap(Keycode.SPACE)
        event = keys.events.get()

    position = encoder.position
    if position != last_position:
        steps = position - last_position
        if REVERSE_KNOB:
            steps = -steps
        key = Keycode.RIGHT_ARROW if steps > 0 else Keycode.LEFT_ARROW
        for _ in range(min(abs(steps), 3)):  # cap fast spins
            tap(key)
        last_position = position

    read_app_messages()
    now_linked = time.monotonic() - last_msg_at < LINK_TIMEOUT_S
    if linked and not now_linked:
        show_local()  # app went quiet → fall back
    linked = now_linked

    led.value = armed
    if armed_light is not None:
        armed_light.value = armed
    time.sleep(0.005)
