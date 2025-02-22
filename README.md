# Get Set up with Expo + React Native

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
    npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

# QR Code Security Mobile Application with Intelligent Features

## 📌 Overview
This project addresses the increasing security vulnerabilities posed by malicious QR codes (Quishing attacks) on college campuses. Our intelligent QR code security application dynamically validates QR codes in real time, eliminating the need for manual pre-validation by IT teams.

Inspired by the **Waymo vs. Tesla** analogy in self-driving technology, our approach provides a **scalable, AI-driven security solution** for QR code scanning—empowering users to safely interact with QR codes without requiring extensive IT oversight.

---

## 🚨 Problem Statement
### 🔴 The Threat: Quishing Attacks  
- Attackers place **malicious QR codes** on walls, bulletin boards, pamphlets, and common campus locations.
- Unsuspecting users scan them, leading to phishing websites or malware-infected pages.

### 🛠️ Limitations of Current Solutions
- **ScanTrust & Similar Tools**  
  - Require IT teams to manually validate every QR code.  
  - Resource-intensive, **not scalable** for large campuses.  

- **Proposed Solution:**  
  - **AI-driven** and **real-time** validation of QR codes, similar to Tesla’s approach in self-driving technology.  
  - Eliminates dependency on pre-validation and manual IT intervention.  

---

## 🕰️ Timeline of Idea Development
| Date       | Milestone |
|------------|-----------|
| **09/26/24** | Created initial QR Code Resources document outlining security concerns. |
| **10/08/24** | Discussed QR security risks with the **Student Safety Committee (SSC)**. |
| **11/03/24 - 11/07/24** | Researched existing QR validation solutions and identified **ScanTrust’s** scalability issue. |
| **11/14/24** | Presented the concept to the **Institutional IT Committee (IITC)**. |
| **11/18/24** | Defined technical features and integrated **real-time validation & threat detection**. |
| **12/06/24** | Finalized the development timeline and **began provisional patent application**. |
| **12/23/24** | Submitted **Provisional Patent Application (PPA)**. |

---

## ⚙️ How It Works
### 🛠️ **Workflow:**
1. **User scans a QR code** through the mobile app.  
2. The app **sends QR code data** to a secure backend server.  
3. The backend server **cross-references the QR code** against known threat databases.  
4. If flagged as **suspicious**, the user receives an **alert and security details**.  
5. If deemed **safe**, the user is **redirected to the intended destination**.  

---

## 🏗️ Technical Stack
### 📱 **Frontend (Mobile App)**
- **iOS & Android support**
- **QR Code Scanner** with secure API calls
- **User-friendly UI** for risk assessment alerts

### 🌐 **Backend (Server)**
- **AI & Machine Learning** for real-time risk analysis  
- **Threat Intelligence Integrations** (e.g., VirusTotal API)  
- **Secure, encrypted database** for logging flagged QR codes  

---

## 📌 Future Development Roadmap
✔️ **Phase 1:** Develop MVP with API integration for threat detection  
✔️ **Phase 2:** Enhance machine learning algorithms for predictive threat detection  
✔️ **Phase 3:** Deploy community-based reporting to improve database accuracy# QR-Code-Cybersecurity-Prototype