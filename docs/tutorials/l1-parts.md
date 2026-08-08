# L1 · The parts, one at a time

Level 1 uses **no simulation loop**. Every lesson calls one module directly — construct it, feed it a state, read what comes back — so you see what each part does before anything hides it inside a loop. This is the slow level that makes every later level fast. Lesson L1.10 builds a small loop by hand from the parts you have met, which is the bridge into [Level 2](l2-simulation.md).

The **Read** column is the handbook page that justifies the model the lesson drives. Do first, then read; the page will feel obvious in the right way.

| Notebook | Type | Time | Goal | Read |
| --- | --- | --- | --- | --- |
| [L1.1 · Aircraft state](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/curriculum/L1_1_aircraft_state.ipynb) | core | 30 min | Make one aircraft and read its state. | [Aircraft](../handbook/aircraft/index.md) |
| [L1.2 · Frame and geometry](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/curriculum/L1_2_frame_and_geometry.ipynb) | depth | 40 min | Calculate a bearing, a distance, and a relative state. | [Aircraft](../handbook/aircraft/index.md) |
| [L1.3 · The performance envelope](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/curriculum/L1_3_performance_envelope.ipynb) | core | 30 min | Describe an airframe as data. | [Performance](../handbook/aircraft/performance.md) |
| [L1.4 · MotionCommand](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/curriculum/L1_4_motion_command.ipynb) | core | 40 min | Write the command that all the modules speak. | [MotionCommand](../handbook/aircraft/index.md#motioncommand) |
| [L1.5 · Kinematics: multirotor](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/curriculum/L1_5_kinematics_multirotor.ipynb) | core | 45 min | Move one multirotor. | [Multirotor](../handbook/aircraft/multirotor.md) |
| [L1.6 · Kinematics: fixed-wing](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/curriculum/L1_6_kinematics_fixedwing.ipynb) | core | 60 min | Move one fixed-wing, and know why it is different. | [Fixed-wing](../handbook/aircraft/fixedwing.md) |
| [L1.7 · Autopilot and mission](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/curriculum/L1_7_autopilot_and_mission.ipynb) | core | 40 min | Give an aircraft a plan; one autopilot serves both airframes. | [Autopilot & mission](../handbook/aircraft/autopilot.md) |
| [L1.8 · Conflict detection](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/curriculum/L1_8_conflict_detection.ipynb) | core | 40 min | Predict a conflict. | [Conflict detection](../handbook/separation/conflict-detection.md) |
| [L1.9 · Conflict resolution](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/curriculum/L1_9_conflict_resolution.ipynb) | core | 60 min | Calculate the way out of one. | [Conflict resolution](../handbook/separation/conflict-resolution.md) |
| [L1.10 · Recovery](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/curriculum/L1_10_recovery.ipynb) | core | 45 min | Decide when to go back to the plan. | [Recovery criteria](../handbook/separation/recovery-criteria.md) |
| [L1.11 · Wind](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/curriculum/L1_11_wind.ipynb) | core | 40 min | Add wind, and know which speed each module uses. | [Wind](../handbook/wind.md) |
| [L1.12 · CNS: navigation](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/curriculum/L1_12_cns_navigation.ipynb) | core | 60 min | Make an aircraft measure itself with an error. | [Navigation](../handbook/cns/navigation.md) |
| [L1.13 · Navigation degradation](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/curriculum/L1_13_navigation_degradation.ipynb) | depth | 40 min | Make an error that continues across steps. | [Navigation](../handbook/cns/navigation.md) |
| [L1.14 · CNS: communication](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/curriculum/L1_14_cns_communication.ipynb) | core | 60 min | Delay, lose, and space out the messages. | [Communication](../handbook/cns/communication.md) |
| [L1.15 · Link gates](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/curriculum/L1_15_link_gates.ipynb) | depth | 40 min | Turn a directed link off for a physical reason. | [Communication](../handbook/cns/communication.md) |
| [L1.16 · CNS: surveillance](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/curriculum/L1_16_cns_surveillance.ipynb) | core | 30 min | Know what the separation logic reads. | [Surveillance](../handbook/cns/surveillance.md) |
| [L1.17 · The RNG and repeatability](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/curriculum/L1_17_rng_and_repeatability.ipynb) | core | 40 min | Make your results repeat. | [Monte Carlo](../handbook/estimators/monte-carlo.md#reproducibility-and-chunking) |

Next: [L2 · One simulation](l2-simulation.md), where the parts become a fleet.
