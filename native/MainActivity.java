package br.com.tijolostavares.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AgendaCelularPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
