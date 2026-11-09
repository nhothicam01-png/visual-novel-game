plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val webAppUrl = (project.findProperty("WEB_APP_URL") as String?)
    ?: "https://nhothicam01-png.github.io/visual-novel-game/thunghiem.html"

android {
    namespace = "vn.visualnovel.studio"
    compileSdk = 35

    defaultConfig {
        applicationId = "vn.visualnovel.studio"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "WEB_APP_URL", "\"$webAppUrl\"")
    }

    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
