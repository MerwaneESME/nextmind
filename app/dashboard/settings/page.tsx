"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Paramètres</h1>
        <p className="text-gray-600">Gérez vos préférences et informations</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Informations personnelles</h2>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <Input label="Nom complet" defaultValue="" />
            <Input label="Email" type="email" defaultValue="" />
            <Input label="Téléphone" type="tel" defaultValue="" />
            <Button>Enregistrer les modifications</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Sécurité</h2>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <Input label="Mot de passe actuel" type="password" />
            <Input label="Nouveau mot de passe" type="password" />
            <Input label="Confirmer le nouveau mot de passe" type="password" />
            <Button>Changer le mot de passe</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-gray-700">Notifications par email</span>
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-gray-700">Alertes de projets</span>
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-gray-700">Nouveaux messages</span>
              <input
                type="checkbox"
                defaultChecked
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

