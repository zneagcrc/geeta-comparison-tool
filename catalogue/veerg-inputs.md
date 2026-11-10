# VEERG input catalogue

Generated from the `*_Arguments` tables in `GAF-VEERG-Functions/Modules/**/*.xlf` by `tools/xlf-catalogue.py`.
These are the methodology inputs in the document's own terms (arguments marked "Input"); constants and calculated
values are in `veerg-inputs.json`.

Single-letter subscripts (`i`, `j`, `z`, ...) are scoped to each equation, as in the documents, so the same letter can
mean different things in different equations. In neutral scenarios those context inputs are keyed by their
description (e.g. "state", "wet or dry climate zone") rather than the letter.

961 arguments in total, 426 marked Input, 276 distinct section/symbol pairs.

## Consistency checks

### Same symbol, different description or unit (28)

| Section | Symbol(s) | Detail |
|---|---|---|
| 3.3 | `MPU` | "input milk production unit" [] / "milk production unit" [] |
| 4.1 | `D_j` | "duration of stay of cattle group" [days] / "length of stay of each cattle group" [days] |
| 4.1 | `I_j` | "dry matter intake for each group j" [kg DM/head/day] / "dry matter intake" [kg DM/head/day] |
| 4.1 | `N_j` | "number of cattle in each group" [head] / "numbers of beef cattle in each group" [head] |
| 4.1 | `i` | "irrigation method" [] / "mean annual temperature" [] / "state" [] |
| 4.2 | `D_j` | "number of days in each time-period (days)" [days] / "number of days in each time-period for each input class" [days] |
| 4.2 | `N_jkl` | "number of beef cattle by time-period, class and subclass" [head] / "number of beef cattle in each time-period, class and subclass" [head] / "number of beef cattle in the calving season by time-period, class and subclass" [head] |
| 4.2 | `W_jkl` | "liveweight (kg)" [kg] / "liveweight (kg/head)" [kg/head] |
| 4.2 | `i` | "irrigation method" [] / "region" [] / "state" [] |
| 4.2 | `z` | "location in leaching zone" [] / "wet or dry climate zone" [] |
| 4.3 | `DPW_j35` | "duration of stay on farm for pre-weaned calves (days)" [days] / "duration of stay on farm for pre-weaned heifer and bull calves" [days] |
| 4.3 | `D_j124` | "duration of stay on farm for classes j=1,2,4 (days)" [days] / "duration of stay on farm for classes j=1,2,4" [days] |
| 4.3 | `D_j35` | "duration of stay on farm for classes j=3,5" [days] / "duration of stay on farm for weaned dairy cattle less than one year old (days)" [days] |
| 4.3 | `MMS_jm179` | "fraction of manure to each primary mms for each class prior to solid separation" [fraction] / "fraction of volatile solids in mms m=1,7,9 before transfer" [fraction] |
| 4.3 | `W_j` | "liveweight (kg)" [kg] / "liveweight" [kg/head] |
| 4.3 | `z` | "location in leaching zone" [] / "wet or dry climate zone" [] |
| 4.4 | `i` | "average temperature" [] / "irrigation method" [] / "state" [] |
| 4.4 | `z` | "location in leaching zone" [] / "wet or dry climate zone" [] |
| 4.6 | `D_jk` | "duration of stay of each class and subclass of poultry" [days] / "duration of stay of each class and subclass" [days] |
| 4.6 | `N_jk` | "number of poultry in each class and subclass" [bird] / "numbers of poultry in each class and subclass" [birds] |
| 4.6 | `i` | "mean annual temperature" [°C] / "state" [] |
| 4.6 | `z` | "location in leaching zone" [] / "wet or dry climate zone" [] |
| 4.7 | `N_j` | "average annual number of livestock per livestock type j" [head] / "number of livestock of each livestock type j" [head] |
| 4.7 | `i` | "irrigation method" [] / "mean annual temperature" [degrees Celsius] / "state" [] |
| 4.7 | `j` | "livestock type" [] / "production system" [] |
| 4.7 | `z` | "location in leaching zone" [] / "wet or dry climate zone" [] |
| 7.1 | `o` | "organic amendment type" [] / "organic amendment" [] |
| 15.3 | `Q_m` | "total quantity of mineral supplement type m used" [kg] / "total quantity of mineral supplement type m used" [t] |

### Same description, different symbols (8)

| Section | Symbol(s) | Detail |
|---|---|---|
| 4.1 | `MMS_jm1T3, MMS_m1T3` | "fraction of manure to tertiary anaerobic lagoon system" |
| 4.1 | `MMS_jm5T1, MMS_m5T1` | "fraction of manure in primary system drylot mms" |
| 4.1 | `MMS_jmT2, MMS_mT2` | "fraction of manure in each secondary system" |
| 4.2 | `i, ir` | "irrigation method" |
| 4.4 | `i, ir` | "irrigation method" |
| 4.5 | `MMS_jmT2, MMSjmT2` | "fraction of manure in each secondary system" |
| 4.6 | `MMS_jmT2, MMS_mT2` | "fraction of manure in each secondary system" |
| 4.7 | `i, ir` | "irrigation method" |

### Short symbol used for different things (across modules) (14)

| Section | Symbol(s) | Detail |
|---|---|---|
| all | `PF` | "fraction of manure applied to soil within farm boundary" / "fraction of manure applied to soil within the farm boundary" / "fraction of manure applied to soil within the feedlot boundary" / "fraction of manure applied to soil within the piggery boundary" |
| all | `c` | "commodity" / "crop residue type" / "crop type" / "fertiliser component" / "livestock type" |
| all | `f` | "freight type" / "inorganic fertiliser type" / "organic fertiliser type" |
| all | `i` | "average temperature" / "irrigation method" / "mean annual temperature" / "region" / "state" / "wet or dry climate zone" |
| all | `ir` | "irrigation method" / "irrigation type" |
| all | `j` | "feed type" / "livestock type" / "production system" |
| all | `m` | "manure management system" / "metropolitan/non-metropolitan location" / "mineral supplement type" |
| all | `o` | "organic amendment type" / "organic amendment" / "origin" |
| all | `p` | "packaging type" / "pasture residue type" / "pasture type" / "pre-season water regime" |
| all | `r` | "rainfall region" / "rainfall zone" |
| all | `s` | "calving season" / "number of cropping seasons in reporting period managed this way" |
| all | `t` | "biological treatment type" / "treatment facility type" |
| all | `w` | "waste type" / "water regime during growing season" |
| all | `z` | "location in leaching zone" / "rainfall zone" / "wet or dry climate zone" |

### Non-standard "kind" value (17)

| Section | Symbol(s) | Detail |
|---|---|---|
| 4.5 | `EF_mT1` | 4.5.1.3 (7): "Lookup" |
| 4.5 | `FracGASMmT1` | 4.5.1.3 (7): "Lookup" |
| 4.5 | `VSLmT1` | 4.5.1.1 (7): "Lookup" |
| 5.1 | `FU_f` | 5.1.1.3 (2): "Lookup" |
| 5.1 | `MU_jf` | 5.1.1.3 (1): "Calculated" |
| 5.1 | `f` | 5.1.1.3 (1): "Lookup" |
| 5.2 | `EF_N2Oi` | 5.2.1.1 (1): "Lookup" |
| 6.1 | `FFOD_c` | 6.1.1.1 (2): "Input or Calculated from 6.1.1.2 (1)(2)" |
| 6.3 | `M_cp` | 6.3.1.1 (2): "Calc from 6.1.1.1 (2) and 6.2.1.1 (2)" |
| 10.1 | `Q_burnw` | 10.1.6 (1): "Input or calculated from 10.1.6, (2)" |
| 11.1 | `6.784x10^(-4)` | 11.1.2 (1): "" |
| 11.1 | `6.784x10^(-4)` | 11.1.3 (1): "" |
| 11.1 | `6.784x10^(-4)` | 11.1.1 (1): "" |
| 11.1 | `6.784x10^(-4)` | 11.1.2 (3): "" |
| 11.1 | `6.784x10^(-4)` | 11.1.2 (0): "" |
| 15.7 | `Q_TPSCCq` | 15.7.1.1 (1): "input" |
| 15.7 | `Q_TPTranstq` | 15.7.1.1 (1): "input" |

## Inputs by section

### 3.1 Enteric methane: beef feedlot

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `D_j` | duration of stay of each cattle lot | days | 3.1.1.1 (1) |
| `EE_j` | ether extract as a percentage of I_j | per cent | 3.1.1.1 (2) |
| `I_j` | dry matter intake | kg DM/head/day | 3.1.1.1 (2) |
| `N_j` | numbers of feedlot cattle in each cattle lot | head | 3.1.1.1 (1) |
| `NDF_j` | neutral detergent fibre as a percentage of I_j | per cent | 3.1.1.1 (2) |

### 3.2 Enteric methane: beef grazing

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `b` | breed of cattle |  | 3.2.1.1 (4), 3.2.1.1 (4) [Variation] |
| `D_j` | number of days the animal is on the farm in each time-period | days | 3.2.1.1 (1) |
| `LC_jk45` | proportion of cows greater than 1 year in calf in the season of calving expressed as a fraction | fraction | 3.2.1.1 (4), 3.2.1.1 (4) [Variation] |
| `LWG_jkl` | live weight gain (kg/head/day) | kg/head/day | 3.2.1.1 (3) |
| `N_jkl` | number of beef cattle in each time-period, class and subclass | head | 3.2.1.1 (1) |
| `W_jkl` | liveweight (kg) | kg | 3.2.1.1 (3) |

### 3.3 Enteric methane: dairy

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `D_j124` | duration of stay on the farm for classes j=1,2,4 | days | 3.3.1.1 (1) |
| `D_j35` | duration of stay on the farm for weaned classes j=3,5 | days | 3.3.1.1 (1) |
| `DMD_j` | dry matter digestibility expressed as a fraction | fraction | 3.3.1.1 (6) |
| `DPW_j35` | duration of stay on the farm for pre-weaned heifer and bull calves | days | 3.3.1.1 (1) |
| `FC_j` | fat content in fat and protein corrected milk | per cent | 3.3.1.1 (5), 3.3.1.1 (5) [Method2] |
| `LWG_j` | liveweight gain | kg/head/day | 3.3.1.1 (3) |
| `MP_j` | milk production (if input as litres of milk) | L/head/day | 3.3.1.1 (4) |
| `MPU` | input milk production unit |  | 3.3.1.1 (4), 3.3.1.1 (5) |
| `MPU` | milk production unit |  | 3.3.1.1 (5) [Method2] |
| `MS_j` | daily production of milk solids | kg MS/head/day | 3.3.1.1 (5), 3.3.1.1 (5) [Method2] |
| `N_j124` | number of dairy cattle in classes j=1,2,4 | head | 3.3.1.1 (1) |
| `N_j35` | number of dairy cattle in classes j=3,5 | head | 3.3.1.1 (1) |
| `PC_j` | protein content in fat and protein corrected milk | per cent | 3.3.1.1 (5), 3.3.1.1 (5) [Method2] |
| `W_j` | liveweight | kg | 3.3.1.1 (3) |

### 3.4 Enteric methane: sheep

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `D_j` | number of days in each time-period | days | 3.4.1.1 (1) |
| `DMA_jk` | dry matter availability | t/ha | 3.4.1.1 (6) |
| `DMD_jk` | dry matter digestibility of feed | fraction | 3.4.1.1 (5) |
| `LMR_jk34` | lamb marking rate per ewe mated | per cent | 3.4.1.1 (8) |
| `LR_jk34` | lambing rate of ewes and maidens | per cent | 3.4.1.1 (8) |
| `N_jk` | numbers of sheep in each time-period and class | head | 3.4.1.1 (1) |
| `W_jk` | liveweight | kg/head | 3.4.1.1 (4) |

### 3.5 Enteric methane: pigs

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `D_j` | the average number of days on farm for each pigs class | days | 3.5.1.1 (1) |
| `I_j` | daily feed ingested by each pigs class | kg/head/day | 3.5.1.1 (2) |
| `N_j` | numbers of pigs of each class | head | 3.5.1.1 (1) |

### 3.6 Enteric methane: other livestock

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `j` | livestock type |  | 3.6.1.1 (1) |
| `N_j` | number of livestock of each livestock type j | head | 3.6.1.1 (1) |

### 4.1 Manure: beef feedlot

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `CP_j` | crude protein content of feed | fraction | 4.1.1.3 (5) |
| `D_j` | duration of stay of cattle group | days | 4.1.1.3 (3) |
| `D_j` | length of stay of each cattle group | days | 4.1.1.1 (1) |
| `DMD_j` | dry matter digestibility for each group j | fraction | 4.1.1.1 (5) |
| `i` | Mean annual temperature |  | 4.1.1.1 (3) [Method2], 4.1.1.1 (4) [Method2] |
| `i` | irrigation method |  | 4.1.1.5 (1) |
| `i` | state |  | 4.1.1.1 (2), 4.1.1.1 (2) [Method2], 4.1.1.1 (3), 4.1.1.1 (4) |
| `I_j` | dry matter intake | kg DM/head/day | 4.1.1.3 (5) |
| `I_j` | dry matter intake for each group j | kg DM/head/day | 4.1.1.1 (5) |
| `j` | production system |  | 4.1.1.5 (1) |
| `MMS_jm1T3` | fraction of manure to tertiary anaerobic lagoon system | fraction | 4.1.1.3 (8) |
| `MMS_jm5T1` | fraction of manure in primary system drylot MMS | fraction | 4.1.1.3 (2) |
| `MMS_jmT2` | fraction of manure in each secondary system | fraction | 4.1.1.3 (6) |
| `MMS_m1T3` | fraction of manure to tertiary anaerobic lagoon system | fraction | 4.1.1.1 (4), 4.1.1.1 (4) [Method2] |
| `MMS_m5T1` | fraction of manure in primary system drylot MMS | fraction | 4.1.1.1 (2), 4.1.1.1 (2) [Method2] |
| `MMS_mT2` | fraction of manure in each secondary system | fraction | 4.1.1.1 (3), 4.1.1.1 (3) [Method2] |
| `N_j` | number of cattle in each group | head | 4.1.1.3 (3) |
| `N_j` | numbers of beef cattle in each group | head | 4.1.1.1 (1) |
| `NR_j` | nitrogen retention expressed as a fraction of intake | fraction | 4.1.1.3 (4) |
| `PF` | fraction of manure applied to soil within the feedlot boundary | fraction | 4.1.1.9 (1) |
| `r` | rainfall zone |  | 4.1.1.5 (1) |

### 4.2 Manure: beef grazing

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `b` | breed of cattle |  | 4.2.1.3 (3), 4.2.1.3 (5), 4.2.1.3 (5) [Variation] |
| `CP_j` | crude protein content of dry matter intake | fraction | 4.2.1.3 (3) |
| `CR_jklcalv` | calving rate for the calving season | head | 4.2.1.3 (3) |
| `CR_jklprev` | calving rate for the previous season | head | 4.2.1.3 (3) |
| `D_j` | number of days in each time-period (days) | days | 4.2.1.3 (2) |
| `D_j` | number of days in each time-period for each input class | days | 4.2.1.1 (1) |
| `DMD_jkl` | dry matter digestibility expressed as a fraction | fraction | 4.2.1.1 (3) |
| `i` | irrigation method |  | 4.2.1.5 (1) |
| `i` | region |  | 4.2.1.1 (2) |
| `i` | state |  | 4.2.1.1 (2), 4.2.1.3 (7) |
| `ir` | irrigation method |  | 4.2.1.7 (2) |
| `j` | production system |  | 4.2.1.5 (1), 4.2.1.7 (2) |
| `LC_jk45` | proportion of cows greater than 1 year lactating for the season of calving and season after calving expressed as a fraction | fraction | 4.2.1.3 (5) |
| `LC_jk5curr` | proportion of cows greater than 2 years lactating for the season of calving | fraction | 4.2.1.3 (5) [Variation] |
| `LC_jk5prev` | proportion of cows greater than 2 years lactating for the season after calving | fraction | 4.2.1.3 (5) [Variation] |
| `LWG_jkl` | liveweight gain (kg/head/day) | kg/head/day | 4.2.1.3 (4) |
| `MAT` | Mean annual temperature | °C | 4.2.1.1 (2) [Method2] |
| `MC_after` | milk consumption for the season after calving | kg/head/day | 4.2.1.3 (3) |
| `MC_calv` | milk consumption for the season of calving | kg/head/day | 4.2.1.3 (3) |
| `MMS_m` | fraction of waste in each manure management system | fraction | 4.2.1.1 (2), 4.2.1.1 (2) [Method2] |
| `N_jkl` | number of beef cattle by time-period, class and subclass | head | 4.2.1.3 (2) |
| `N_jkl` | number of beef cattle in each time-period, class and subclass | head | 4.2.1.1 (1) |
| `N_jkl` | number of beef cattle in the calving season by time-period, class and subclass | head | 4.2.1.3 (3) |
| `r` | rainfall zone |  | 4.2.1.5 (1) |
| `s` | Calving season |  | 4.2.1.3 (3) |
| `W_jkl` | liveweight (kg) | kg | 4.2.1.3 (7) |
| `W_jkl` | liveweight (kg/head) | kg/head | 4.2.1.3 (3), 4.2.1.3 (6) |
| `z` | location in leaching zone |  | 4.2.1.7 (2) |
| `z` | wet or dry climate zone |  | 4.2.1.3 (1) |

### 4.3 Manure: dairy

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `CP_j` | crude protein content of feed intake | fraction | 4.3.1.3 (5) |
| `D_j124` | duration of stay on farm for classes j=1,2,4 | days | 4.3.1.1 (1) |
| `D_j124` | duration of stay on farm for classes j=1,2,4 (days) | days | 4.3.1.3 (3) |
| `D_j35` | duration of stay on farm for classes j=3,5 | days | 4.3.1.1 (1) |
| `D_j35` | duration of stay on farm for weaned dairy cattle less than one year old (days) | days | 4.3.1.3 (3) |
| `DMD_j` | dry matter digestibility | fraction | 4.3.1.1 (3) |
| `DPW_j35` | duration of stay on farm for pre-weaned calves (days) | days | 4.3.1.3 (3) |
| `DPW_j35` | duration of stay on farm for pre-weaned heifer and bull calves | days | 4.3.1.1 (1) |
| `i` | state | state | 4.3.1.1 (2) |
| `ir` | irrigation method |  | 4.3.1.10 (1), 4.3.1.12 (2), 4.3.1.5 (1), 4.3.1.6 (2) |
| `j` | production system |  | 4.3.1.10 (1), 4.3.1.12 (2), 4.3.1.5 (1), 4.3.1.6 (2) |
| `LWG_j` | liveweight gain | kg/head/day | 4.3.1.3 (6) |
| `MAT` | Mean annual temperature | °C | 4.3.1.1 (2) [Method2] |
| `MMS_jm` | manure management system fraction for class j and system m | fraction | 4.3.1.3 (2) |
| `MMS_jm179` | fraction of manure to each primary MMS for each class prior to solid separation | fraction | 4.3.1.1 (4) |
| `MMS_jm179` | fraction of volatile solids in MMS m=1,7,9 before transfer | fraction | 4.3.1.1 (5) |
| `MMS_jm4` | fraction of volatile solids in solid storage before transfer | fraction | 4.3.1.1 (5) |
| `MP_j` | milk production (if input as litres of milk) | L/head/day | 4.3.1.3 (6) |
| `MPU` | input milk production unit |  | 4.3.1.3 (6) |
| `N_j124` | number of dairy cattle in classes j=1,2,4 | head | 4.3.1.1 (1), 4.3.1.3 (3) |
| `N_j35` | number of dairy cattle in classes j=3,5 | head | 4.3.1.1 (1), 4.3.1.3 (3) |
| `PF` | fraction of manure applied to soil within farm boundary | fraction | 4.3.1.8 (1) |
| `r` | rainfall region |  | 4.3.1.10 (1), 4.3.1.5 (1) |
| `SS_m` | fraction of volatile solids separated to solid storage for each MMS | fraction | 4.3.1.1 (4), 4.3.1.1 (5) |
| `W_j` | liveweight | kg/head | 4.3.1.3 (7), 4.3.1.3 (8) |
| `W_j` | liveweight (kg) | kg | 4.3.1.3 (4) |
| `z` | Wet or dry climate zone |  | 4.3.1.9 (1) |
| `z` | location in leaching zone |  | 4.3.1.12 (2), 4.3.1.6 (2) |

### 4.4 Manure: sheep

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `CP_jk` | crude protein content of feed intake expressed as a fraction | fraction | 4.4.1.3 (4) |
| `D_j` | number of days in each time-period | days | 4.4.1.1 (1), 4.4.1.3 (2) |
| `DMD_jk` | dry matter digestibility expressed as a fraction | fraction | 4.4.1.1 (3) |
| `GW_k` | greasy wool production per sheep class | kg/head | 4.4.1.3 (8) |
| `i` | average temperature |  | 4.4.1.1 (2) |
| `i` | irrigation method |  | 4.4.1.5 (1) |
| `i` | state |  | 4.4.1.1 (2) [Method1], 4.4.1.3 (10) |
| `ir` | irrigation method |  | 4.4.1.7 (2) |
| `j` | production system |  | 4.4.1.5 (1), 4.4.1.7 (2) |
| `LWG_jk` | liveweight gain | kg/head/day | 4.4.1.3 (9) |
| `MMS_m` | fraction of waste in each manure management system | fraction | 4.4.1.1 (2), 4.4.1.1 (2) [Method1] |
| `N_jk` | number of sheep in each time-period and input class | head | 4.4.1.1 (1), 4.4.1.3 (2) |
| `PL_jk6` | proportion of lambs born in the lambing season | fraction | 4.4.1.3 (5) |
| `r` | rainfall zone |  | 4.4.1.5 (1) |
| `W_jk` | liveweight | kg/head | 4.4.1.3 (10) |
| `Y_k` | average clean wool yield per sheep class | fraction | 4.4.1.3 (8) |
| `z` | location in leaching zone |  | 4.4.1.7 (2) |
| `z` | wet or dry climate zone |  | 4.4.1.3 (1) |

### 4.5 Manure: pigs

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `D_j` | duration of stay of pigs group | days | 4.5.1.3 (5) |
| `Dj` | length of stay of each class of pigs | days | 4.5.1.1 (1) |
| `i` | state |  | 4.5.1.1 (6) |
| `ir` | irrigation method |  | 4.5.1.5 (1), 4.5.1.7 (2) |
| `j` | production system |  | 4.5.1.5 (1), 4.5.1.7 (2) |
| `MAT` | Mean annual temperature | °C | 4.5.1.1 (6) [Method2] |
| `MMS_jm179T1` | fraction of manure in primary liquid systems (m=1,7,9) | fraction | 4.5.1.3 (4) |
| `MMS_jm4T1` | fraction of manure in solid storage MMS | fraction | 4.5.1.3 (4) |
| `MMS_jmT1` | fraction of manure in primary MMS | fraction | 4.5.1.3 (3) |
| `MMS_jmT2` | fraction of manure in each secondary system | fraction | 4.5.1.3 (6) |
| `MMSjm179T1` | fraction of manure in MMS 1, 7, and 9 in treatment stage 1 | fraction | 4.5.1.1 (5) |
| `MMSjm4T1` | fraction of manure in solid storage primary system | fraction | 4.5.1.1 (5) |
| `MMSjmT1` | fraction of manure to each primary MMS for each class prior to solid separation | fraction | 4.5.1.1 (4) |
| `MMSjmT2` | fraction of manure in each secondary system | fraction | 4.5.1.1 (6), 4.5.1.1 (6) [Method2] |
| `N_j` | number of pigs in each group | head | 4.5.1.3 (5) |
| `Nj` | numbers of pigs in each class | head | 4.5.1.1 (1) |
| `NW_j` | nitrogen produced in pigs manure and waste feed in each class | kg N/head/day | 4.5.1.3 (5) |
| `PF` | fraction of manure applied to soil within the piggery boundary | fraction | 4.5.1.9 (1) |
| `r` | rainfall region |  | 4.5.1.5 (1) |
| `SN_m` | fraction of nitrogen separated to solid storage for each MMS | fraction | 4.5.1.3 (3), 4.5.1.3 (4) |
| `SSm` | fraction of volatile solids separated to solid storage for each MMS | fraction | 4.5.1.1 (4), 4.5.1.1 (5) |
| `VSj` | volatile solid production from pigs in each class | kg/head/day | 4.5.1.1 (3), 4.5.1.1 (7) |
| `z` | location in leaching zone |  | 4.5.1.7 (2) |

### 4.6 Manure: poultry

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `CP_jk` | crude protein content of feed | fraction | 4.6.1.3 (5) |
| `D_jk` | duration of stay of each class and subclass | days | 4.6.1.3 (3) |
| `D_jk` | duration of stay of each class and subclass of poultry | days | 4.6.1.1 (1) |
| `DMD_jk` | dry matter digestibility for each class and subclass | fraction | 4.6.1.1 (5) |
| `i` | mean annual temperature | °C | 4.6.1.1 (2) [Method2], 4.6.1.1 (3) [Method2] |
| `i` | state |  | 4.6.1.1 (2), 4.6.1.1 (3) |
| `I_jk` | dry matter intake for each class and subclass | kg DM/bird/day | 4.6.1.1 (5), 4.6.1.3 (5) |
| `ir` | irrigation method |  | 4.6.1.12 (1), 4.6.1.14 (2), 4.6.1.5 (1), 4.6.1.7 (2) |
| `j` | production system |  | 4.6.1.12 (1), 4.6.1.14 (2), 4.6.1.5 (1), 4.6.1.7 (2) |
| `MMS_jmT1` | fraction of manure in each primary system | fraction | 4.6.1.1 (2), 4.6.1.1 (2) [Method2], 4.6.1.1 (4), 4.6.1.3 (2) |
| `MMS_jmT2` | fraction of manure in each secondary system | fraction | 4.6.1.1 (3), 4.6.1.1 (3) [Method2] |
| `MMS_mT2` | fraction of manure in each secondary system | fraction | 4.6.1.3 (6) |
| `N_jk` | number of poultry in each class and subclass | bird | 4.6.1.3 (3) |
| `N_jk` | numbers of poultry in each class and subclass | birds | 4.6.1.1 (1) |
| `PF` | fraction of manure applied to soil within the farm boundary | fraction | 4.6.1.9 (1) |
| `r` | rainfall region |  | 4.6.1.12 (1), 4.6.1.5 (1) |
| `z` | location in leaching zone |  | 4.6.1.14 (2), 4.6.1.7 (2) |
| `z` | wet or dry climate zone |  | 4.6.1.10 (1) |

### 4.7 Manure: other livestock

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `i` | irrigation method |  | 4.7.1.5 (1) |
| `i` | mean annual temperature | degrees Celsius | 4.7.1.1 (2) [Method2] |
| `i` | state |  | 4.7.1.1 (2) |
| `ir` | irrigation method |  | 4.7.1.7 (2) |
| `j` | livestock type |  | 4.7.1.1 (1), 4.7.1.3 (2) |
| `j` | production system |  | 4.7.1.5 (1), 4.7.1.7 (2) |
| `m` | manure management system |  | 4.7.1.1 (1) |
| `N_j` | average annual number of livestock per livestock type j | head | 4.7.1.1 (1) |
| `N_j` | number of livestock of each livestock type j | head | 4.7.1.3 (2) |
| `r` | rainfall zone |  | 4.7.1.5 (1) |
| `z` | location in leaching zone |  | 4.7.1.7 (2) |
| `z` | wet or dry climate zone |  | 4.7.1.3 (1) |

### 5.1 Inorganic fertiliser

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `c` | Crop type |  | 5.1.1.1 (1) [Method2] |
| `ir` | irrigation method |  | 5.1.1.1 (1), 5.1.1.1 (1) [Method2] |
| `j` | Production system |  | 5.1.1.1 (1), 5.1.1.1 (1) [Method2], 5.1.1.3 (1) |
| `N_fjCotton` | application rate of inorganic fertiliser type f in the cotton crop | kg N/ha | 5.1.1.2 (3) |
| `N_fjIrrigatedMaize` | application rate of inorganic fertiliser type f in the irrigated maize crop | kg N/ha | 5.1.1.2 (1) |
| `N_fjNonIrrigatedGrains` | application rate of inorganic fertiliser type f in the grains crop | kg N/ha | 5.1.1.2 (2) |
| `TM_jf` | total mass of inorganic fertiliser type f applied to production system j | kg | 5.1.1.1 (2), 5.1.1.3 (2) |
| `z` | rainfall zone |  | 5.1.1.1 (1), 5.1.1.1 (1) [Method2] |

### 5.2 Organic fertiliser

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `f` | Organic fertiliser type |  | 5.2.1.1 (2) |
| `FN_organicf` | nitrogen fraction of organic fertiliser type f | kg N/kg | 5.2.1.1 (2) |
| `i` | Wet or dry climate zone |  | 5.2.1.1 (1) |
| `j` | Production system |  | 5.2.1.1 (1) |
| `M_organicjf` | mass of organic fertiliser type f applied to production system j | kg | 5.2.1.1 (2) |

### 5.3 Lime

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `FracLime` | fraction of lime as limestone (CaCO3) | fraction | 5.3.1.1 (1) |
| `M_lime` | total mass of lime applied to production system | kg | 5.3.1.1 (1) |

### 5.4 Atmospheric deposition

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `ir` | irrigation method |  | 5.4.1.1 (1), 5.4.1.3 (1) |
| `j` | Production system |  | 5.4.1.1 (1), 5.4.1.3 (1) |
| `r` | rainfall region |  | 5.4.1.1 (1), 5.4.1.3 (1) |

### 5.5 Leaching and runoff

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `ir` | irrigation method |  | 5.5.1.1 (2), 5.5.1.1 (3) |
| `j` | production system |  | 5.5.1.1 (2), 5.5.1.1 (3) |
| `z` | location in leaching zone |  | 5.5.1.1 (2), 5.5.1.1 (3) |

### 6.1 Return of crop residues to soils

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `B` | number of bales generated |  | 6.1.1.2 (2) |
| `c` | Crop type |  | 6.1.1.1 (1), 6.1.1.1 (2), 6.1.1.1 (2) [Method2], 6.1.1.2 (1), 6.1.1.2 (2) |
| `F_c` | fraction of crop residue that is burnt for crop c | fraction | 6.1.1.1 (2), 6.1.1.1 (2) [Method2] |
| `FFOD_c` | fraction of the crop residue that is removed for crop c | fraction | 6.1.1.1 (2) [Method2] |
| `FFOD_cother` | Fraction of crop residue that is removed for crop c, calculated where residues are removed by other means | fraction | 6.1.1.2 (1) |
| `i` | Wet or dry climate zone |  | 6.1.1.1 (1) |
| `M_B` | mass of each bale | kg | 6.1.1.2 (2) |
| `M_removed` | mass of residue removed | kg | 6.1.1.2 (1) |
| `P_c` | annual production of crop c | kg | 6.1.1.1 (2), 6.1.1.1 (2) [Method2], 6.1.1.2 (1), 6.1.1.2 (2) |
| `State` | State or territory |  | 6.1.1.1 (2), 6.1.1.1 (2) [Method2] |

### 6.2 Return of pasture residues to soils

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `A_p` | area of pasture renewed or removed | ha | 6.2.1.1 (2), 6.2.1.1 (2) [Method2] |
| `i` | Wet or dry climate zone |  | 6.2.1.1 (1) |
| `p` | Pasture type |  | 6.2.1.1 (1), 6.2.1.1 (2), 6.2.1.1 (2) [Method2] |
| `Y_p` | average yield of pasture crop | t DM/ha | 6.2.1.1 (2) [Method2] |

### 6.3 Leaching and run-off from crop and pasture residues

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `c` | Crop residue type |  | 6.3.1.1 (1), 6.3.1.1 (2) |
| `ir` | Irrigation type |  | 6.3.1.1 (2) |
| `p` | Pasture residue type |  | 6.3.1.1 (1), 6.3.1.1 (2) |
| `z` | Location in leaching zone |  | 6.3.1.1 (2) |

### 6.4 Field burning of crop residues

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `c` | Crop type |  | 6.4.1.1 (1), 6.4.1.1 (2), 6.4.1.1 (3) |
| `P_c` | annual production of crop type c | kg | 6.4.1.1 (3) |

### 7.1 Rice cultivation

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `A_ricewpo` | annual area of rice cultivation under water regime w, pre-season water regime p, and organic amendment condition o | ha | 7.1.1.1 (1) |
| `o` | organic amendment |  | 7.1.1.1 (2) |
| `o` | organic amendment type |  | 7.1.1.1 (3) |
| `p` | pre-season water regime |  | 7.1.1.1 (2) |
| `ROA_o` | application rate of organic amendment o | tonnes/ha | 7.1.1.1 (3) |
| `s` | number of cropping seasons in reporting period managed this way | seasons | 7.1.1.1 (1) |
| `t_ricewpo` | cultivation period for rice under conditions w, p, and o | days | 7.1.1.1 (1) |
| `w` | water regime during growing season |  | 7.1.1.1 (2) |

### 8.1 Fuel: transport

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `Q_Transtq` | Amount of fuel type q combusted for transport energy purposes | Varies based on fuel type: kL, m3, GJ | 8.1.1.1 (1) |

### 8.2 Fuel: stationary

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `Q_SCq` | Amount of fuel type q used for stationary combustion operations | Varies based on fuel type: kL, m3, GJ | 8.2.1.1 (1) |

### 9.1 Refrigerants

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `a` | Appliance type |  | 9.1.1 (1) |
| `charge_Ra` | Amount of refrigerant R contained in appliance a | kg | 9.1.1 (1) |
| `R` | Refrigerant |  | 9.1.1 (1) |

### 10.1 Solid waste

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `Q_burn` | quantity of solid waste being open-burned, on a wet weight basis | t | 10.1.5 (1) |
| `Q_burnw` | quantity of solid waste type w being open-burned, on a wet weight basis | t | 10.1.6 (1) |
| `Q_t` | quantity of solid waste being sent to biological treatment type t, on a wet weight basis | t | 10.1.1 (1), 10.1.3 (1) |
| `Q_u` | quantity of solid waste going to unmanaged waste disposal method u, on a wet weight basis | t | 10.1.7 (1) |
| `Q_wu` | quantity of solid waste type w going to unmanaged waste disposal method u, on a wet weight basis | t | 10.1.8 (1) |
| `t` | biological treatment type |  | 10.1.1 (1), 10.1.3 (1) |
| `u` | unmanaged waste disposal method |  | 10.1.7 (1), 10.1.8 (1) |
| `V_burnw` | volume of solid waste type w being open-burned | m3 | 10.1.6 (2) |
| `w` | waste type |  | 10.1.6 (1), 10.1.6 (2), 10.1.8 (1) |

### 11.1 Wastewater

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `c` | commodity |  | 11.1.1 (1), 11.1.1 (2), 11.1.1 (2) [Method2], 11.1.1 (3), 11.1.3 (1) |
| `COD_inc` | average inlet Chemical Oxygen Demand (COD) concentration of wastewater for production of commodity c | kg COD/m3 | 11.1.1 (2), 11.1.1 (2) [Method2], 11.1.1 (3) |
| `COD_out` | average outlet COD concentration of wastewater | kg COD/m3 | 11.1.1 (2) [Method2] |
| `F_removed` | fraction of COD removed from the wastewater treatment facility and transferred to landfill, biochar production, or other site | dimensionless | 11.1.1 (2), 11.1.1 (2) [Method2] |
| `F_sludge` | fraction of COD removed from wastewater as sludge | dimensionless | 11.1.1 (2), 11.1.1 (2) [Method2] |
| `Q_cap` | quantity of methane in sludge biogas captured for combustion for the operation of the treatment facility | m3 CH4 | 11.1.2 (0), 11.1.2 (1), 11.1.2 (3) |
| `Q_flared` | quantity of methane in sludge biogas flared by the treatment facility | m3 CH4 | 11.1.2 (0), 11.1.2 (1), 11.1.2 (3), 11.1.4 (1) |
| `Q_out` | quantity of methane in sludge biogas transferred out of the treatment facility | m3 CH4 | 11.1.2 (0), 11.1.2 (1), 11.1.2 (3) |
| `R_c` | fraction of methane recovered for flaring or combustion for production of commodity c | dimensionless | 11.1.1 (1), 11.1.3 (1) |
| `t` | treatment facility type |  | 11.1.1 (2), 11.1.1 (2) [Method2] |
| `W_t` | quantity of wastewater treated at facility type t | m3 | 11.1.1 (2), 11.1.1 (2) [Method2] |

### 12.1 Supplementary CO2

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `Q` | quantity of supplementary CO2 used within the operations | kg CO2 | 12.1.1.1 (1) |

### 14.1 Electricity (scope 2)

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `g` | Grid electricity was purchased from |  | 14.1.1 (1) |
| `i` | state |  | 14.1.2 (1) |
| `JRPP` | jurisdictional renewable power percentage for the applicable period (ACT only) | per cent | 14.1.2 (1) |
| `Q_elec` | amount of electricity purchased from the grid | kWh | 14.1.1 (1), 14.1.2 (1) |
| `REC_onsite` | Renewable Energy Certificates issued for electricity produced on-site during the year and consumed by the entity | MWh | 14.1.2 (1) |
| `REC_surrendered` | Renewable Energy Certificates voluntarily surrendered in the reporting year | MWh | 14.1.2 (1) |
| `RPP` | Renewable Power Percentage under the Large-scale Renewable Energy Target (LRET) | per cent | 14.1.2 (1) |

### 15.1 Scope 3: purchased livestock

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `c` | livestock type |  | 15.1.1.1 (1) |
| `N_co` | number of animals purchased in livestock type c from origin o | head | 15.1.1.1 (1) |
| `o` | origin |  | 15.1.1.1 (1) |
| `W_co` | average liveweight of purchased livestock at point of purchase | kg/head | 15.1.1.1 (1) |

### 15.2 Scope 3: purchased feed

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `j` | feed type |  | 15.2.1.1 (1) |
| `Q_j` | quantity of feed type j purchased | kg | 15.2.1.1 (1) |

### 15.3 Scope 3: purchased mineral supplements for livestock

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `m` | mineral supplement type |  | 15.3.1.1 (1), 15.3.1.1 (1) [Variation] |
| `Q_m` | total quantity of mineral supplement type m used | t | 15.3.1.1 (1) |
| `Q_m` | total quantity of mineral supplement type m used | kg | 15.3.1.1 (1) [Variation] |

### 15.4 Scope 3: purchased fertiliser

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `c` | fertiliser component |  | 15.4.1.1 (2) |
| `f` | inorganic fertiliser type |  | 15.4.1.1 (1), 15.4.1.1 (2) |
| `F_cf` | percent of component c contained within the inorganic fertiliser f | percent | 15.4.1.1 (2) |
| `j` | production system |  | 15.4.1.1 (1), 15.4.1.1 (2) |
| `TM_jf` | quantity of inorganic fertiliser type f purchased and applied to production system j | kg | 15.4.1.1 (1), 15.4.1.1 (2) |

### 15.5 Scope 3: purchased agrichemicals

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `h` | agrichemical type |  | 15.5.1.1 (1) |
| `Q_h` | quantity of active ingredients in agrichemical type h purchased and applied to soils | kg ai | 15.5.1.1 (1) |

### 15.6 Scope 3: purchased lime

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `M_a` | total quantity of soil ameliorant applied to soils | kg | 15.6.1.1 (1) |

### 15.7 Scope 3: purchased services and contractors

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `i` | State |  | 15.7.1.1 (1) [Variation] |
| `m` | metropolitan/non-metropolitan location |  | 15.7.1.1 (1) [Variation] |
| `Q_TPSCCq` | amount of fuel type q used for stationary combustion operations by the third-party | kL, m3 or t | 15.7.1.1 (1), 15.7.1.1 (1) [Variation] |
| `Q_TPTranstq` | amount of fuel type q combusted in each transport type t by the third-party | kL or m3 | 15.7.1.1 (1), 15.7.1.1 (1) [Variation] |

### 15.8 Scope 3: purchased packaging

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `p` | packaging type |  | 15.8.1.1 (1) |
| `Q_p` | amount of packaging type p | kg or piece | 15.8.1.1 (1) |

### 15.9 Scope 3: purchased grow media

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `activity_data` | measured activity for the purchased good or service | varies | 15.9.1.1 (1) |

### 15.10 Scope 3: other purchased goods and services

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `i` | state |  | 15.10.1.1 (3) |
| `m` | metropolitan/non-metropolitan location |  | 15.10.1.1 (3) |
| `Q_SCq` | amount of fuel q used for stationary combustion operations | kL | 15.10.1.1 (3) |
| `Q_Transq` | amount of fuel q combusted for transport energy purposes | kL | 15.10.1.1 (2) |

### 15.11 Scope 3: upstream emissions from fuel

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `g` | grid electricity was purchased from |  | 15.11.1.1 (1) |
| `i` | state |  | 15.11.1.2 (1) |
| `JRPP` | jurisdictional renewable power percentage for the applicable period (ACT only) | per cent | 15.11.1.2 (1) |
| `Q_elec` | amount of electricity purchased from the grid | kWh | 15.11.1.1 (1), 15.11.1.2 (1) |
| `REC_onsite` | Renewable Energy Certificates issued for electricity produced on-site during the year and consumed by the entity | MWh | 15.11.1.2 (1) |
| `REC_surrendered` | Renewable Energy Certificates voluntarily surrendered in the reporting year | MWh | 15.11.1.2 (1) |
| `RPP` | Renewable Power Percentage under the Large-scale Renewable Energy Target (LRET) | per cent | 15.11.1.2 (1) |

### 15.12 Scope 3: upstream emissions from purchased electricity

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `Q_wf` | quantity of solid waste of type w being sent to treatment facility f (t), on a wet weight basis | t | 15.12.1.1 (1) |
| `R_f` | methane recovery fraction of treatment facility type | dimensionless | 15.12.1.1 (1) |
| `V_wf` | volume of solid waste type w being sent to treatment facility f (m3) | m3 | 15.12.1.1 (2) |

### 15.13 Scope 3: management of waste

| Symbol | Description | Unit | Used in |
|---|---|---|---|
| `D_f` | total distance transported per freight type f | km | 15.13.1.1 (1) |
| `f` | freight type |  | 15.13.1.1 (1) |
| `W_f` | total mass of goods transported per freight type f | t | 15.13.1.1 (1) |
