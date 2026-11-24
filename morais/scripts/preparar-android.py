"""Ajusta o projeto Android do app Orçamento Morais: widget, WhatsApp, ícone, versão e assinatura."""
import os, pathlib, re, shutil

raiz = pathlib.Path(__file__).resolve().parent.parent
app = raiz / "android" / "app" / "src" / "main"
pacote = app / "java" / "br" / "com" / "moraistavares" / "orcamento"
pacote.mkdir(parents=True, exist_ok=True)
for nome in ("WhatsEnviarPlugin.java", "OrcamentoWidget.java", "MainActivity.java"):
    shutil.copy(raiz / "native" / nome, pacote / nome)

manifesto = app / "AndroidManifest.xml"
txt = manifesto.read_text(encoding="utf-8")
if "OrcamentoWidget" not in txt:
    txt = txt.replace("</application>", """        <receiver android:name=".OrcamentoWidget" android:exported="false" android:label="Orçamento Morais">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/orcamento_widget_info" />
        </receiver>
    </application>""")
if "<queries>" not in txt:
    txt = txt.replace("<application", """<queries>
        <package android:name="com.whatsapp" />
        <package android:name="com.whatsapp.w4b" />
    </queries>
    <application""", 1)
manifesto.write_text(txt, encoding="utf-8")

res = app / "res"
for pasta in (raiz / "android-res").iterdir():
    destino = res / pasta.name
    destino.mkdir(parents=True, exist_ok=True)
    for arq in pasta.iterdir():
        shutil.copy(arq, destino / arq.name)

n = os.environ.get("VERSAO", "1")
gradle = raiz / "android" / "app" / "build.gradle"
g = gradle.read_text(encoding="utf-8")
g = re.sub(r"versionCode \d+", f"versionCode {n}", g)
g = re.sub(r'versionName "[^"]*"', f'versionName "1.0.{n}"', g)
# assinatura fixa, pra instalar as versões novas por cima
chave = (raiz.parent / "assinatura" / "tijolos.keystore").as_posix()
if "signingConfigs.fixa" not in g:
    g = re.sub(r"android\s*\{", "android {\n    signingConfigs {\n        fixa {\n            storeFile file('" + chave + "')\n            storePassword 'android'\n            keyAlias 'androiddebugkey'\n            keyPassword 'android'\n        }\n    }\n", g, count=1)
    g = re.sub(r"buildTypes\s*\{", "buildTypes {\n        debug {\n            signingConfig signingConfigs.fixa\n        }", g, count=1)
gradle.write_text(g, encoding="utf-8")
print("Orçamento Morais preparado, versão 1.0." + n)
