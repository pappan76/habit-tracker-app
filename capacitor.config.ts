export default {
  appId: "com.rwwltd.habittracker",
  appName: "Habit Tracker",
  webDir: "build",
  server: {
    androidScheme: "https"
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#3B82F6",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};