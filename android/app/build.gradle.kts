plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val ksFile: String? = System.getenv("KS_FILE")

android {
    namespace = "com.lumeaplay.tv"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.lumeaplay.tv"
        minSdk = 21
        targetSdk = 34
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = "1.0." + (System.getenv("GITHUB_RUN_NUMBER") ?: "0")
    }

    signingConfigs {
        if (ksFile != null) {
            create("release") {
                storeFile = file(ksFile)
                storePassword = System.getenv("KS_PASS")
                keyAlias = System.getenv("KS_ALIAS") ?: "lumeaplay"
                keyPassword = System.getenv("KS_PASS")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (ksFile != null) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
    }

    // o app de TV (HTML/JS) fica em /web/tv e entra no APK como assets
    sourceSets["main"].assets.srcDirs("../../web/tv")

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}

dependencies {
    val media3 = "1.4.1"
    implementation("androidx.media3:media3-exoplayer:$media3")
    implementation("androidx.media3:media3-exoplayer-hls:$media3")
    implementation("androidx.media3:media3-ui:$media3")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.annotation:annotation:1.8.2")
}
