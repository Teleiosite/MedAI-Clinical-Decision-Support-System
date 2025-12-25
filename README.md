# MedAI Clinical Decision Support System

A comprehensive hybrid predictive-prescriptive application designed for elderly patients with type 2 diabetes, hypertension, and metabolic syndrome. This system combines machine learning risk prediction with LLM-powered recommendation systems while ensuring safety, transparency, and clinical guideline alignment.

## 🏥 Project Overview

This application serves as a clinical decision support tool for healthcare providers treating elderly diabetic patients. It integrates predictive analytics with prescriptive recommendations to enhance clinical decision-making while maintaining strict safety protocols and regulatory compliance.

### 🐞 Recent Development & Bug Fixes

We've recently tackled a critical bug preventing patient data from being saved correctly. The application would get stuck in a "Saving..." state, indicating a failure in the data persistence layer with Firebase.

**Problem:**
*   **Symptom:** The UI would hang indefinitely on the "Saving..." state when creating or updating a patient.
*   **Root Cause Analysis:** The investigation pointed towards an issue with the data being sent to Firestore. While the Firebase configuration (`firebase.json`, `firestore.rules`) was correct, the Firestore client library can hang if it receives invalid data types, such as `NaN`, without throwing a clear error. This was likely happening with calculated fields like BMI or eGFR, or from empty form inputs being coerced into `NaN` instead of `null`.

**Solutions Implemented:**
1.  **Robust Data Sanitization:**
    *   A `cleanNumber` utility function was implemented and applied to all numeric fields before they are sent to Firestore. This function converts any non-numeric or `NaN` values to `null`, which is a valid type for Firestore.
2.  **Improved Developer Experience (DX):**
    *   The `package.json` `dev` script was updated to `firebase emulators:exec 'vite'`. This ensures the Firebase Emulators are always running in sync with the Vite development server, preventing connectivity issues during development.
3.  **Code Quality & Type Safety:**
    *   Resolved several ESLint violations related to the use of `any` and `Function` types. The component's state and handler functions have been refactored to be fully type-safe, reducing the risk of future bugs.

**Current Status:**
*   The data persistence issue is resolved. The application can now successfully create and update patient data in the Firestore emulator.
*   The development environment is more stable and easier to manage.


## 🎯 Current Focus: Phase 1 - Backend Integration with Firebase

We are currently executing Phase 1 of our development plan. The primary objective is to replace the mock data currently used in the frontend with a robust, scalable backend powered by **Firebase**. This involves setting up the Firestore database, defining the data structure, implementing authentication for providers, and integrating the frontend application to perform real data operations.

### Firebase Integration Plan

#### 1. **Project Setup & Configuration**
- [x] **Local Setup**: Initialized Firebase project using the CLI (`firebase init`) to create configuration files (`firebase.json`, `firestore.rules`, `storage.rules`) and set up the local emulator suite.
- [ ] **Cloud Project**: Create a new project on the Firebase console.
- [ ] **Frontend Config**: Configure and store the Firebase project configuration object as environment variables in the frontend application.
- [x] **Client Library**: A new client has been created at `src/lib/firebase.ts` for all database interactions.


#### 2. **Database Collection Design**
The following top-level collections will be created in **Firestore** to structure the application's data. **Firestore Security Rules** will be implemented to ensure data privacy and appropriate access control.

- **`patients`**: Stores demographic, clinical, and functional status information for each patient as individual documents.
- **`medications`**: Manages the list of medications. Each medication will be a document, potentially in a sub-collection under a specific patient.
- **`lab_results`**: Contains laboratory results (e.g., HbA1c, glucose levels), structured as documents within a patient's sub-collection.
- **`risk_assessments`**: Stores the outputs from the machine learning models as documents, linked to a specific patient.
- **`treatment_plans`**: Caches the LLM-generated treatment recommendations as documents.
- **`safety_alerts`**: Logs all generated safety alerts as documents.

#### 3. **Authentication & Security**
- [ ] Utilize **Firebase Authentication** to manage healthcare provider accounts (e.g., login, password reset).
- [ ] Implement strict **Firestore Security Rules** on all collections. This is critical to ensure that a logged-in provider can only access data for patients under their care.

#### 4. **Storage for Medical Documents**
- [ ] Set up **Cloud Storage for Firebase** to handle uploads of medical documents.
- [ ] Create a dedicated storage path with appropriate **Firebase Storage Security Rules** to restrict access.

#### 5. **Frontend Service Layer**
- [ ] Develop a set of service functions (e.g., `getPatient`, `createPatient`, `updateMedication`) that encapsulate all Firestore queries.
- [x] Integrate these service functions into the UI components using the existing **React Query (`@tanstack/react-query`)** setup to manage data fetching, caching, and state synchronization.

---

## 🚀 Development Phases

### **Phase 1: Backend Integration (In Progress)**
- [x] Plan Firebase integration strategy.
- [x] Initialize Firebase project locally (`firebase init`).
- [x] Set up Firestore database with the defined collections.
- [ ] Implement authentication and user management for healthcare providers.
- [x] Create API service layer for all CRUD operations.
- [x] **Goal:** Replace all mock data in the UI with live data from Firebase.

### Phase 2: ML Model Development (Estimated: 3-4 weeks)
- [ ] Develop and train Random Forest models.
- [ ] Implement Neural Network architectures.
- [ ] Set up model serving infrastructure using Python FastAPI.
- [ ] Integrate SHAP/LIME explainability.

### Phase 3: LLM Integration (Estimated: 2-3 weeks)
- [ ] Set up OpenAI API integration.
- [ ] Implement RAG for clinical guidelines.
- [ ] Develop safety guardrails and validation.
- [ ] Create treatment plan generation pipeline.

### Phase 4: Advanced Features (Estimated: 3-4 weeks)
- [ ] Real-time alert system using Firestore snapshots.
- [ ] EHR integration capabilities.
- [ ] Advanced analytics and reporting.

### Phase 5: Testing & Deployment (Estimated: 2-3 weeks)
- [ ] Comprehensive testing suite.
- [ ] Security audit and compliance verification.
- [ ] Production deployment and monitoring.

## 🛠 Technical Stack

### Frontend
- **React 18** with TypeScript
- **Vite**
- **Tailwind CSS** with **shadcn/ui**
- **React Router** & **React Query**

### Backend
- **Firebase** (Firestore, Authentication, Cloud Storage)
- **Python FastAPI** for ML/LLM services
- **OpenAI API**
- **Redis** (Planned for caching)

### Machine Learning (Planned)
- **Scikit-learn**, **TensorFlow/PyTorch**
- **SHAP/LIME**, **MLflow**
