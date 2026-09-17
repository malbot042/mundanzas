from django.contrib import admin

from .models import Mudanza


@admin.register(Mudanza)
class MudanzaAdmin(admin.ModelAdmin):
    list_display = ("cliente_nombre", "fecha_mudanza", "estado", "creado")
    list_filter = ("estado", "fecha_mudanza")
    search_fields = ("cliente_nombre", "cliente_telefono", "cliente_email")
