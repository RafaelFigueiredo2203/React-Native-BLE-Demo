# React Native BLE Demo

This is a demo project using React Native CLI (without Expo) to scan and connect to BLE (Bluetooth Low Energy) devices.

## ⚙️ Technologies Used

- React Native (Bare CLI)
- TypeScript
- `@react-native-ble-plx` for BLE communication
- Android (tested via emulator, no physical BLE available at the moment)

## 🚀 Features

- Requests location permission (Android)
- Scans for nearby BLE devices
- Displays found devices in a list
- Button to start/stop scanning

## 📱 Prerequisites

- Node.js installed
- Android Studio for Android emulator (or physical device)
- React Native CLI

## 📦 Installation

```bash
git clone https://github.com/your-user/your-repo.git
cd your-repo
npm install
npx react-native run-android
