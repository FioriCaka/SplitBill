package io.ionic.starter;

import android.content.Context;
import android.util.Log;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Collections;
import java.util.List;

public final class FirebaseInitializer {
	private static final String TAG = "FirebaseInitializer";

	private FirebaseInitializer() {
		// no-op
	}

	@SuppressWarnings("unchecked")
	public static boolean ensureInitialized(Context context) {
		try {
			Class<?> firebaseAppClass = Class.forName("com.google.firebase.FirebaseApp");
			Method getApps = firebaseAppClass.getMethod("getApps", Context.class);
			List<?> apps = (List<?>) getApps.invoke(null, context);
			if (apps == null) {
				apps = Collections.emptyList();
			}
			if (!apps.isEmpty()) {
				return true;
			}

			Method initializeApp = firebaseAppClass.getMethod("initializeApp", Context.class);
			initializeApp.invoke(null, context);
			return true;
		} catch (ClassNotFoundException e) {
			Log.w(TAG, "Firebase SDK not found on classpath. Did Gradle pull com.google.firebase:firebase-messaging?", e);
		} catch (NoSuchMethodException | IllegalAccessException | InvocationTargetException e) {
			Log.e(TAG, "Failed to initialize Firebase. Check google-services.json under android/app.", e);
		}
		return false;
	}
}
