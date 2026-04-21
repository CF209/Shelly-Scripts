The following scripts were written for the Shelly Plus RGBW PM:

## blu_button_control.js

Adds the ability to control the lights from a Shelly BLU Button Tough (it might work with other BLU buttons as well)

To use:
- Find the MAC address of your BLU button. The Shelly BLE Debug app is useful for this. Replace BUTTON_MAC with your MAC address
- Edit the different button functions to whatever actions you would like

## pwm_input_handling.js

Adds light control from a PWM input. The Shelly doesn't natively support PWM on the analog input, and the signal is very noisy, so a stability algorithm was used to help account for this, but the brightness still jumps around a bunch when adjusting the switch.