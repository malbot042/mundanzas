import json

from django.conf import settings
from django.contrib import messages
from django.http import FileResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_http_methods

from .forms import MudanzaForm
from .models import Mudanza


def mudanza_list(request):
    mudanzas = Mudanza.objects.all()

    cliente = request.GET.get("cliente", "").strip()
    estado = request.GET.get("estado", "").strip()
    fecha = request.GET.get("fecha", "").strip()

    if cliente:
        mudanzas = mudanzas.filter(cliente_nombre__icontains=cliente)
    if estado:
        mudanzas = mudanzas.filter(estado=estado)
    if fecha:
        mudanzas = mudanzas.filter(fecha_mudanza=fecha)

    context = {
        "mudanzas": mudanzas,
        "estados": Mudanza.Estado.choices,
        "filtros": {"cliente": cliente, "estado": estado, "fecha": fecha},
    }
    return render(request, "mudanzas/list.html", context)


def mudanza_create(request):
    if request.method == "POST":
        form = MudanzaForm(request.POST)
        if form.is_valid():
            mudanza = form.save()
            messages.success(request, f"Mudanza de {mudanza.cliente_nombre} guardada.")
            return redirect("mudanzas:list")
    else:
        form = MudanzaForm()
    return render(request, "mudanzas/form.html", {"form": form, "modo": "crear"})


def mudanza_edit(request, pk):
    mudanza = get_object_or_404(Mudanza, pk=pk)
    if request.method == "POST":
        form = MudanzaForm(request.POST, instance=mudanza)
        if form.is_valid():
            form.save()
            messages.success(request, f"Mudanza de {mudanza.cliente_nombre} actualizada.")
            return redirect("mudanzas:list")
    else:
        form = MudanzaForm(instance=mudanza)
    return render(
        request, "mudanzas/form.html", {"form": form, "modo": "editar", "mudanza": mudanza}
    )


def mudanza_print(request, pk):
    mudanza = get_object_or_404(Mudanza, pk=pk)
    return render(request, "mudanzas/print.html", {"mudanza": mudanza})


def service_worker(request):
    """Sirve el service worker desde la raíz del sitio (en vez de /static/js/)
    para que su scope cubra toda la app y pueda cachear las páginas de
    listado, alta, edición e impresión."""
    path = settings.BASE_DIR / "static" / "js" / "service-worker.js"
    return FileResponse(open(path, "rb"), content_type="application/javascript")


@require_http_methods(["POST"])
def api_sync(request):
    """Recibe una mudanza guardada offline en el cliente e la crea o actualiza
    en el servidor, usando ``client_uuid`` para no duplicarla si se reintenta."""
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"error": "JSON inválido"}, status=400)

    client_uuid = data.get("client_uuid")
    if not client_uuid:
        return JsonResponse({"error": "client_uuid requerido"}, status=400)

    form_fields = {k: v for k, v in data.items() if k in MudanzaForm.base_fields}

    try:
        mudanza = Mudanza.objects.get(client_uuid=client_uuid)
        form = MudanzaForm(form_fields, instance=mudanza)
    except Mudanza.DoesNotExist:
        form = MudanzaForm(form_fields)

    if not form.is_valid():
        return JsonResponse({"error": form.errors}, status=400)

    mudanza = form.save(commit=False)
    mudanza.client_uuid = client_uuid
    mudanza.save()

    return JsonResponse(
        {"status": "ok", "id": mudanza.pk, "client_uuid": str(mudanza.client_uuid)}
    )
