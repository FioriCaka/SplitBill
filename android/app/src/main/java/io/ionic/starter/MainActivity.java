package io.ionic.starter;

import android.os.Bundle;
import android.util.Log;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.getcapacitor.BridgeActivity;
import io.ionic.starter.plugins.FirebaseStatusPlugin;

public class MainActivity extends BridgeActivity {
	private static final String TAG = "MainActivity";

	@Override
	protected void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		ensureFirebaseInitialized();
		registerPlugin(PushNotificationsPlugin.class);
		registerPlugin(FirebaseStatusPlugin.class);
	}

	private void ensureFirebaseInitialized() {
		boolean ready = FirebaseInitializer.ensureInitialized(this);
		if (!ready) {
			Log.e(TAG, "Firebase not ready. Push notifications will fail until google-services.json is configured.");
		}
	}
}
