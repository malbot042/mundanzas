import uuid

from django.db import models


class Mudanza(models.Model):
    class Estado(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        CONFIRMADA = "confirmada", "Confirmada"
        EN_CURSO = "en_curso", "En curso"
        COMPLETADA = "completada", "Completada"
        CANCELADA = "cancelada", "Cancelada"

    # Identificador generado en el cliente (offline) para poder sincronizar
    # sin crear duplicados si una misma mudanza se reenvía al backend.
    client_uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    cliente_nombre = models.CharField("Nombre del cliente", max_length=150)
    cliente_telefono = models.CharField("Teléfono", max_length=30)
    cliente_email = models.EmailField("Email", blank=True)

    direccion_origen = models.CharField("Dirección de origen", max_length=255)
    direccion_destino = models.CharField("Dirección de destino", max_length=255)
    fecha_mudanza = models.DateField("Fecha de la mudanza")

    inventario = models.TextField("Inventario / objetos a mover", blank=True)
    observaciones = models.TextField("Observaciones", blank=True)

    firma_cliente = models.CharField("Nombre de quien firma", max_length=150, blank=True)
    conforme = models.BooleanField("El cliente da su conformidad", default=False)

    estado = models.CharField(
        "Estado", max_length=20, choices=Estado.choices, default=Estado.PENDIENTE
    )

    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-fecha_mudanza", "-creado"]
        verbose_name = "mudanza"
        verbose_name_plural = "mudanzas"

    def __str__(self):
        return f"{self.cliente_nombre} — {self.fecha_mudanza}"
