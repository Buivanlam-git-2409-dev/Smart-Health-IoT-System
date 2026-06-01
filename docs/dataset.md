# Dataset Description

This document provides detailed information about the datasets used to train and evaluate the AI models in the Smart Health IoT project.

## 1. Anemia Eye Dataset

The model for anemia detection uses images of the human eye, specifically focusing on the **conjunctiva** (the mucous membrane covering the white part of the eye and the inner surface of the eyelids).

### Source & Acquisition
- **Primary Source:** Kaggle `clean-augmented-anemia-dataset` (Source ID: `t2obd1a1253kmit/clean-augmented-anemia-dataset`).
- **Data Selection:** Only the `Conjuctiva` / `Eye` subset is used. Other parts like `Finger_Nails` or `Palm` were excluded to ensure high specificity for eye-based screening.

### Data Split & Statistics
The dataset is split into Training, Validation, and Testing sets. Classes are balanced in the validation and testing sets.

| Split | Total Images | Anemic | Non-Anemic |
| :--- | :---: | :---: | :---: |
| **Training** | 8,256 | 4,219 | 4,037 |
| **Validation** | 1,000 | 500 | 500 |
| **Testing** | 1,000 | 500 | 500 |

### Preprocessing & Augmentation
The following steps were applied to improve model generalization and performance:

- **Preprocessing:**
  - Resized to **224 x 224** pixels.
  - Pixel normalization following **MobileNetV2** standards (scaling pixels to the [-1, 1] range).
- **Augmentation (Applied to Training set only):**
  - **Random Rotation:** up to 15 degrees.
  - **Width & Height Shift:** up to 10%.
  - **Zoom Range:** up to 10%.
  - **Horizontal Flip:** Enabled.

---

## 2. Tongue Multitask Dataset

The tongue analysis model uses a multi-task dataset to simultaneously recognize surface features and predict potential organ-related indicators.

### Data Split & Statistics
The dataset consists of the following splits:

| Split | Total Images | Number of Columns (Labels/Features) |
| :--- | :---: | :---: |
| **Training** | 3,371 | 18 |
| **Validation** | 843 | 18 |
| **Testing** | 895 | 19 |

### Task Description & Labeling
- **Task 1: Feature Recognition (8 Features):**
  - **Tongue Pale:** Indicator for anemia or blood/qi deficiency.
  - **Tip/Side Red:** Indicates heat in the Heart/Liver systems.
  - **Spot:** Red spots or points of stasis.
  - **Ecchymosis:** Signs of blood stasis (bruising).
  - **Crack:** Indicates yin deficiency or fluid depletion.
  - **Toothmark:** Often related to Spleen deficiency.
  - **Fur Thick:** Indicator of dampness or food stagnation.
  - **Fur Yellow:** Indicator of heat syndrome.

- **Task 2: Organ Indicator Prediction (5 Targets):**
  - **Heart**
  - **Lung**
  - **Spleen**
  - **Liver**
  - **Kidney**

### Model Architecture & Preprocessing
- **Architecture:** EfficientNet-B0 (Multi-head).
- **Input Size:** 224 x 224 pixels.
- **Preprocessing:** ImageNet normalization (Mean: [0.485, 0.456, 0.406], Std: [0.229, 0.224, 0.225]).
- **Augmentation:** Horizontal flip, subtle rotation (5 degrees), and brightness/contrast adjustments (ColorJitter).

---

## 3. Limitations & Ethical Considerations
- **Dataset Size:** The dataset is relatively small compared to clinical-grade medical imaging standards.
- **Lighting Conditions:** Performance may vary significantly under different lighting conditions or camera qualities.
- **Not for Medical Diagnosis:** This project is an experimental prototype. Results should not be used for clinical diagnosis without consultation from a professional medical doctor.
