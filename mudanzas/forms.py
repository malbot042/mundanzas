from django import forms

from .models import Mudanza


class MudanzaForm(forms.ModelForm):
    class Meta:
        model = Mudanza
        fields = [
            "cliente_nombre",
            "cliente_telefono",
            "cliente_email",
            "direccion_origen",
            "direccion_destino",
            "fecha_mudanza",
            "inventario",
            "observaciones",
            "firma_cliente",
            "conforme",
            "estado",
        ]
        widgets = {
            "fecha_mudanza": forms.DateInput(attrs={"type": "date"}),
            "inventario": forms.Textarea(attrs={"rows": 4}),
            "observaciones": forms.Textarea(attrs={"rows": 3}),
        }
