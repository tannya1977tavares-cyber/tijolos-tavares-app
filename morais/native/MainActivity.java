package br.com.moraistavares.orcamento;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WhatsEnviarPlugin.class);
        super.onCreate(savedInstanceState);
        abrirOrcamento(getIntent());
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        abrirOrcamento(intent);
    }

    /** Toque no "Colar pedido" do widget: abre o orçamento já colando o pedido. */
    private void abrirOrcamento(Intent intent) {
        try {
            if (intent == null || getBridge() == null) return;
            String acao = intent.getStringExtra("abrir");
            if (acao == null) return;
            intent.removeExtra("abrir");
            if (!"colar".equals(acao)) return;
            final String url = getBridge().getLocalUrl() + "/index.html#colar";
            getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(url));
        } catch (Exception ignored) {
        }
    }
}
