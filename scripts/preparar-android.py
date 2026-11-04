"""Ajusta o projeto Android gerado pelo Capacitor: plugin do calendário, permissões e ícone."""
import pathlib, shutil, re

raiz = pathlib.Path(__file__).resolve().parent.parent
app = raiz / "android" / "app" / "src" / "main"
pacote = app / "java" / "br" / "com" / "tijolostavares" / "app"
pacote.mkdir(parents=True, exist_ok=True)
for nome in ("AgendaCelularPlugin.java", "AtualizadorPlugin.java", "MainActivity.java"):
    shutil.copy(raiz / "native" / nome, pacote / nome)

manifesto = app / "AndroidManifest.xml"
txt = manifesto.read_text(encoding="utf-8")
perms = [
    "android.permission.READ_CALENDAR",
    "android.permission.WRITE_CALENDAR",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.REQUEST_INSTALL_PACKAGES",
]
extra = "".join(f'    <uses-permission android:name="{p}" />\n' for p in perms if p not in txt)
txt = txt.replace("</manifest>", extra + "</manifest>")
manifesto.write_text(txt, encoding="utf-8")

res = app / "res"
for pasta in (raiz / "android-res").iterdir():
    destino = res / pasta.name
    destino.mkdir(parents=True, exist_ok=True)
    for arq in pasta.iterdir():
        shutil.copy(arq, destino / arq.name)

# número da versão: cresce a cada APK, pra o Android aceitar atualizar por cima
import os
n = os.environ.get("VERSAO", "1")
gradle = raiz / "android" / "app" / "build.gradle"
g = gradle.read_text(encoding="utf-8")
g = re.sub(r"versionCode \d+", f"versionCode {n}", g)
g = re.sub(r'versionName "[^"]*"', f'versionName "1.0.{n}"', g)
gradle.write_text(g, encoding="utf-8")
print("Android preparado, versão 1.0." + n)
