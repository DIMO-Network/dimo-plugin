# DIMO Signal Reference

All signal names usable with `telemetry_get_signals_time_series` and confirmed via `telemetry_get_available_signals`.

## Motion & Position

| Signal | Unit | Description |
|---|---|---|
| `speed` | km/h | Vehicle speed |
| `angularVelocityYaw` | °/s | Rotation rate along Z axis |
| `currentLocationAltitude` | m | Altitude (WGS 84) |
| `currentLocationHeading` | ° | Heading relative to geographic north (0–360) |
| `currentLocationCoordinates` | — | Current location (lat/lng, requires location privilege) |
| `currentLocationApproximateCoordinates` | — | Approximate location (H3 resolution 6) |

## Powertrain — General

| Signal | Unit | Description |
|---|---|---|
| `powertrainType` | — | Powertrain type string |
| `powertrainRange` | km | Remaining range (all energy sources) |

## Powertrain — Combustion Engine

| Signal | Unit | Description |
|---|---|---|
| `powertrainCombustionEngineSpeed` | rpm | Engine RPM |
| `powertrainCombustionEngineTorque` | Nm | Current engine torque |
| `powertrainCombustionEngineTorquePercent` | % | Torque as % of reference |
| `powertrainCombustionEngineECT` | °C | Coolant temperature |
| `powertrainCombustionEngineEOT` | °C | Oil temperature |
| `powertrainCombustionEngineEOP` | kPa | Oil pressure |
| `powertrainCombustionEngineMAF` | g/s | Mass air flow |
| `powertrainCombustionEngineTPS` | % | Throttle position (0–100) |
| `powertrainCombustionEngineEngineOilLevel` | — | Oil level status (string) |
| `powertrainCombustionEngineEngineOilRelativeLevel` | % | Oil level as percentage |
| `powertrainCombustionEngineDieselExhaustFluidLevel` | % | DEF tank level |
| `powertrainCombustionEngineDieselExhaustFluidCapacity` | L | DEF tank capacity |

## Powertrain — Fuel System

| Signal | Unit | Description |
|---|---|---|
| `powertrainFuelSystemRelativeLevel` | % | Fuel tank level (0–100) |
| `powertrainFuelSystemAbsoluteLevel` | L | Fuel in tank |
| `powertrainFuelSystemAccumulatedConsumption` | L | Total fuel consumed |
| `powertrainFuelSystemSupportedFuelTypes` | — | Supported fuel types (string) |

## Powertrain — Transmission

| Signal | Unit | Description |
|---|---|---|
| `powertrainTransmissionTravelledDistance` | km | Odometer |
| `powertrainTransmissionCurrentGear` | — | Current gear (0=neutral, neg=reverse) |
| `powertrainTransmissionActualGear` | — | Engaged gear (0=neutral) |
| `powertrainTransmissionActualGearRatio` | — | Gear ratio |
| `powertrainTransmissionSelectedGear` | — | Selected gear (126=park) |
| `powertrainTransmissionTemperature` | °C | Gearbox temperature |
| `powertrainTransmissionIsClutchSwitchOperated` | — | Clutch switch status |
| `powertrainTransmissionRetarderActualTorque` | % | Retarder torque |
| `powertrainTransmissionRetarderTorqueMode` | — | Active torque mode (string) |

## Powertrain — Traction Battery (EV/PHEV)

| Signal | Unit | Description |
|---|---|---|
| `powertrainTractionBatteryStateOfChargeCurrent` | % | State of charge (0–100) |
| `powertrainTractionBatteryStateOfChargeCurrentEnergy` | kWh | State of charge in energy |
| `powertrainTractionBatteryStateOfHealth` | % | Battery health (0–100) |
| `powertrainTractionBatteryRange` | km | EV range remaining |
| `powertrainTractionBatteryGrossCapacity` | kWh | Gross battery capacity |
| `powertrainTractionBatteryCurrentVoltage` | V | High voltage battery voltage |
| `powertrainTractionBatteryCurrentPower` | W | Energy flow in/out of battery |
| `powertrainTractionBatteryTemperatureAverage` | °C | Average cell temperature |
| `powertrainTractionBatteryChargingIsCharging` | — | Charging in progress |
| `powertrainTractionBatteryChargingIsChargingCableConnected` | — | Cable connected |
| `powertrainTractionBatteryChargingPower` | kW | Instantaneous charge power |
| `powertrainTractionBatteryChargingAddedEnergy` | kWh | Energy added this session |
| `powertrainTractionBatteryChargingChargeLimit` | % | Target charge limit |
| `powertrainTractionBatteryChargingChargeCurrentAC` | A | AC charging current |
| `powertrainTractionBatteryChargingChargeVoltageUnknownType` | V | Charging voltage at inlet |

## Chassis & Brakes

| Signal | Unit | Description |
|---|---|---|
| `chassisBrakeIsPedalPressed` | — | Brake pedal pressed |
| `chassisBrakePedalPosition` | % | Brake pedal position (0–100) |
| `chassisBrakeABSIsWarningOn` | — | ABS warning active |
| `chassisBrakeCircuit1PressurePrimary` | kPa | Brake circuit 1 pressure |
| `chassisBrakeCircuit2PressurePrimary` | kPa | Brake circuit 2 pressure |
| `chassisParkingBrakeIsEngaged` | — | Parking brake engaged |
| `chassisTireSystemIsWarningOn` | — | Tire system warning |
| `chassisAxleRow1WheelLeftTirePressure` | kPa | FL tire pressure |
| `chassisAxleRow1WheelRightTirePressure` | kPa | FR tire pressure |
| `chassisAxleRow2WheelLeftTirePressure` | kPa | RL tire pressure |
| `chassisAxleRow2WheelRightTirePressure` | kPa | RR tire pressure |
| `chassisAxleRow1WheelLeftSpeed` | km/h | FL wheel speed |
| `chassisAxleRow1WheelRightSpeed` | km/h | FR wheel speed |
| `chassisAxleRow3Weight` | kg | Axle 3 load |
| `chassisAxleRow4Weight` | kg | Axle 4 load |
| `chassisAxleRow5Weight` | kg | Axle 5 load |

## Cabin & Body

| Signal | Unit | Description |
|---|---|---|
| `bodyLockIsLocked` | — | Central lock status |
| `bodyLightsIsAirbagWarningOn` | — | Airbag/SRS warning |
| `bodyTrunkFrontIsOpen` | — | Front trunk open |
| `bodyTrunkRearIsOpen` | — | Rear trunk open |
| `cabinDoorRow1DriverSideIsOpen` | — | Driver door open |
| `cabinDoorRow1DriverSideWindowIsOpen` | — | Driver window open |
| `cabinDoorRow1PassengerSideIsOpen` | — | Passenger door open |
| `cabinDoorRow1PassengerSideWindowIsOpen` | — | Passenger window open |
| `cabinDoorRow2DriverSideIsOpen` | — | Rear driver door open |
| `cabinDoorRow2DriverSideWindowIsOpen` | — | Rear driver window open |
| `cabinDoorRow2PassengerSideIsOpen` | — | Rear passenger door open |
| `cabinDoorRow2PassengerSideWindowIsOpen` | — | Rear passenger window open |
| `cabinSeatRow1DriverSideIsBelted` | — | Driver seatbelt |
| `cabinSeatRow1PassengerSideIsBelted` | — | Passenger seatbelt |
| `cabinSeatRow2DriverSideIsBelted` | — | Rear driver seatbelt |
| `cabinSeatRow2MiddleIsBelted` | — | Rear middle seatbelt |
| `cabinSeatRow2PassengerSideIsBelted` | — | Rear passenger seatbelt |
| `cabinSeatRow3DriverSideIsBelted` | — | 3rd row driver seatbelt |
| `cabinSeatRow3PassengerSideIsBelted` | — | 3rd row passenger seatbelt |

## Environment

| Signal | Unit | Description |
|---|---|---|
| `exteriorAirTemperature` | °C | Outside air temperature |
| `isIgnitionOn` | — | Ignition on/off |
| `lowVoltageBatteryCurrentVoltage` | V | 12V battery voltage |
| `connectivityCellularIsJammingDetected` | — | Cellular jamming detected |

## OBD-II

| Signal | Unit | Description |
|---|---|---|
| `obdEngineLoad` | % | Engine load (PID 04) |
| `obdThrottlePosition` | % | Throttle position (PID 11) |
| `obdIntakeTemp` | °C | Intake temperature (PID 0F) |
| `obdMAP` | kPa | Manifold pressure (PID 0B) |
| `obdFuelPressure` | kPa | Fuel pressure (PID 0A) |
| `obdFuelRailPressure` | kPa | Fuel rail pressure |
| `obdFuelRate` | L/h | Fuel rate (PID 5E) |
| `obdFuelTypeName` | — | Fuel type (PID 51, string) |
| `obdEthanolPercent` | % | Ethanol in fuel (PID 52) |
| `obdOilTemperature` | °C | Oil temperature (PID 5C) |
| `obdRunTime` | s | Engine run time (PID 1F) |
| `obdBarometricPressure` | kPa | Barometric pressure (PID 33) |
| `obdCommandedEGR` | % | EGR command (PID 2C) |
| `obdCommandedEVAP` | % | EVAP purge (PID 2E) |
| `obdShortTermFuelTrim1` | % | Short-term fuel trim bank 1 (PID 06) |
| `obdLongTermFuelTrim1` | % | Long-term fuel trim bank 1 (PID 07) |
| `obdShortTermFuelTrim2` | — | Short-term fuel trim bank 2 |
| `obdLongTermFuelTrim2` | % | Long-term fuel trim bank 2 (PID 09) |
| `obdMAF` | — | Mass air flow (via OBD) |
| `obdMaxMAF` | g/s | Maximum MAF (PID 50) |
| `obdO2WRSensor1Voltage` | V | O2 sensor 1 voltage |
| `obdO2WRSensor2Voltage` | V | O2 sensor 2 voltage |
| `obdDistanceSinceDTCClear` | km | Distance since codes cleared (PID 31) |
| `obdDistanceWithMIL` | km | Distance with MIL on (PID 21) |
| `obdWarmupsSinceDTCClear` | — | Warm-ups since codes cleared (PID 30) |
| `obdStatusDTCCount` | — | Active DTC count |
| `obdDTCList` | — | Active DTC codes (string) |
| `obdIsEngineBlocked` | — | Engine block status |
| `obdIsPTOActive` | — | PTO active (PID 1E) |
| `obdIsPluggedIn` | — | OBD device plugged in |

## Service

| Signal | Unit | Description |
|---|---|---|
| `serviceDistanceToService` | km | Remaining distance to service |
| `serviceTimeToService` | s | Remaining time to service |
