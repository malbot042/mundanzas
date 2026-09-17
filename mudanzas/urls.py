from django.urls import path

from . import views

app_name = "mudanzas"

urlpatterns = [
    path("", views.mudanza_list, name="list"),
    path("nueva/", views.mudanza_create, name="create"),
    path("<int:pk>/editar/", views.mudanza_edit, name="edit"),
    path("<int:pk>/imprimir/", views.mudanza_print, name="print"),
    path("api/sync/", views.api_sync, name="api_sync"),
]
