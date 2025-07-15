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


## What and Why
In today's digital landscape, QR codes have become an integral part of our daily lives, connecting the physical and online worlds with a simple scan. However, this convenience comes with a hidden risk. Cybercriminals are increasingly exploiting QR codes to launch malicious attacks, a practice known as "quishing" (QR code phishing). Unsuspecting users can be redirected to fake websites designed to steal personal information, tricked into downloading malware, or even have their online accounts compromised. The very simplicity of QR codes makes them a potent tool for cyberattacks, as the destination of the code is not visible to the naked eye.

While most modern smartphones have built-in QR code scanning capabilities, these native scanners often lack the sophisticated security features needed to protect users from these emerging threats. They typically open links automatically, without first verifying their safety, leaving users vulnerable. This is where your app idea for a secure QR code scanner becomes not just a useful tool, but a necessary one. By validating the legitimacy of QR codes before they are executed on a user's device, your app would provide a critical layer of security that is currently missing for many.

The need for such an app is clear. As QR code usage continues to grow, so too will the number of associated security incidents. Your app would address a tangible and growing market need, offering users peace of mind and protecting them from the financial and personal consequences of a malicious scan. By focusing on security and user trust, you can build a reputable brand and a loyal user base in a market where existing solutions have not yet fully addressed the security concerns of the average user. This app has the potential to become an essential utility for anyone who regularly interacts with QR codes, making the digital world a safer place one scan at a time.


## Planned Features

### 🎯 Core Functionality

#### Camera Scanner Tab
- **QR Code Detection**: Real-time QR code scanning with camera integration
- **Dual Validation System**:
   - **Virus Total API Integration**: Automated threat detection using VirusTotal's URL scanning service
   - **Community Safety Ratings**: User-generated safety tags (Safe/Unsafe)

#### Scan History Tab
- **Historical Records**: Complete log of all previous QR code scans
- **Safety Status Display**: Visual indicators showing scan results (Safe/Unsafe)
- **User Tag Management**: Ability to modify safety tags post-scan
- **Scan Details**: Timestamp, URL, and validation results for each entry

#### Backend Infrastructure
- **Data Storage**: Persistent storage for user tags and scan history
- **Community Database**: Shared safety ratings across all users
- **Real-time Updates**: Dynamic safety status updates based on community feedback


