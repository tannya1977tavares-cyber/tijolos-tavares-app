package br.com.moraistavares.orcamento;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/** Widget da tela inicial: bloco que abre o orçamento rápido num toque. */
public class OrcamentoWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_orcamento);
            v.setOnClickPendingIntent(R.id.w_topo, abrir(ctx, "novo", 1));
            v.setOnClickPendingIntent(R.id.w_novo, abrir(ctx, "novo", 2));
            v.setOnClickPendingIntent(R.id.w_colar, abrir(ctx, "colar", 3));
            mgr.updateAppWidget(id, v);
        }
    }

    static PendingIntent abrir(Context ctx, String acao, int req) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setAction("orcamento." + acao);
        i.putExtra("abrir", acao);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, req, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
