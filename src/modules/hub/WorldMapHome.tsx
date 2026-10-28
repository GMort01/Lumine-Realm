import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Clock, Compass, Heart, LoaderCircle, MapPin, Sparkles, UserPlus } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './worldMapHome.css';
import { ADMIN_EMAIL } from '../../config/roles';
import { realmMembersService } from '../../services/realmMembersService';
import type { RealmInvitation, RealmMember } from '../../services/realmMembersService';

interface WorldMapHomeProps {
  user: SupabaseUser | null;
}

interface ResolvedMember extends RealmMember {
  displayName: string;
  countryName: string;
  avatar: string | null;
}

interface CountryLocation {
  coordinates: [number, number];
  timezone: string;
  label: string;
  flag: string;
}

function MapInvalidator() {
  const map = useMap();

  useEffect(() => {
    const invalidateSize = () => {
      window.requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    };
    const timeoutId = window.setTimeout(invalidateSize, 200);
    const observer = new ResizeObserver(invalidateSize);
    observer.observe(map.getContainer());

    return () => {
      window.clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [map]);

  return null;
}

const COUNTRY_LOCATIONS: Record<string, CountryLocation> = {
  co: { coordinates: [4.711, -74.0721], timezone: 'America/Bogota', label: 'Colombia', flag: '🇨🇴' },
  colombia: { coordinates: [4.711, -74.0721], timezone: 'America/Bogota', label: 'Colombia', flag: '🇨🇴' },
  pe: { coordinates: [-12.0464, -77.0428], timezone: 'America/Lima', label: 'Perú', flag: '🇵🇪' },
  peru: { coordinates: [-12.0464, -77.0428], timezone: 'America/Lima', label: 'Perú', flag: '🇵🇪' },
  mx: { coordinates: [19.4326, -99.1332], timezone: 'America/Mexico_City', label: 'México', flag: '🇲🇽' },
  mexico: { coordinates: [19.4326, -99.1332], timezone: 'America/Mexico_City', label: 'México', flag: '🇲🇽' },
  ar: { coordinates: [-34.6037, -58.3816], timezone: 'America/Argentina/Buenos_Aires', label: 'Argentina', flag: '🇦🇷' },
  argentina: { coordinates: [-34.6037, -58.3816], timezone: 'America/Argentina/Buenos_Aires', label: 'Argentina', flag: '🇦🇷' },
  cl: { coordinates: [-33.4489, -70.6693], timezone: 'America/Santiago', label: 'Chile', flag: '🇨🇱' },
  chile: { coordinates: [-33.4489, -70.6693], timezone: 'America/Santiago', label: 'Chile', flag: '🇨🇱' },
  br: { coordinates: [-15.7975, -47.8919], timezone: 'America/Sao_Paulo', label: 'Brasil', flag: '🇧🇷' },
  brasil: { coordinates: [-15.7975, -47.8919], timezone: 'America/Sao_Paulo', label: 'Brasil', flag: '🇧🇷' },
  brazil: { coordinates: [-15.7975, -47.8919], timezone: 'America/Sao_Paulo', label: 'Brasil', flag: '🇧🇷' },
  us: { coordinates: [38.9072, -77.0369], timezone: 'America/New_York', label: 'Estados Unidos', flag: '🇺🇸' },
  'estados unidos': { coordinates: [38.9072, -77.0369], timezone: 'America/New_York', label: 'Estados Unidos', flag: '🇺🇸' },
  usa: { coordinates: [38.9072, -77.0369], timezone: 'America/New_York', label: 'Estados Unidos', flag: '🇺🇸' },
  ca: { coordinates: [45.4215, -75.6972], timezone: 'America/Toronto', label: 'Canadá', flag: '🇨🇦' },
  canada: { coordinates: [45.4215, -75.6972], timezone: 'America/Toronto', label: 'Canadá', flag: '🇨🇦' },
  es: { coordinates: [40.4168, -3.7038], timezone: 'Europe/Madrid', label: 'España', flag: '🇪🇸' },
  espana: { coordinates: [40.4168, -3.7038], timezone: 'Europe/Madrid', label: 'España', flag: '🇪🇸' },
  uk: { coordinates: [51.5072, -0.1276], timezone: 'Europe/London', label: 'Reino Unido', flag: '🇬🇧' },
  'reino unido': { coordinates: [51.5072, -0.1276], timezone: 'Europe/London', label: 'Reino Unido', flag: '🇬🇧' },
  fr: { coordinates: [48.8566, 2.3522], timezone: 'Europe/Paris', label: 'Francia', flag: '🇫🇷' },
  francia: { coordinates: [48.8566, 2.3522], timezone: 'Europe/Paris', label: 'Francia', flag: '🇫🇷' },
  de: { coordinates: [52.52, 13.405], timezone: 'Europe/Berlin', label: 'Alemania', flag: '🇩🇪' },
  alemania: { coordinates: [52.52, 13.405], timezone: 'Europe/Berlin', label: 'Alemania', flag: '🇩🇪' },
  it: { coordinates: [41.9028, 12.4964], timezone: 'Europe/Rome', label: 'Italia', flag: '🇮🇹' },
  italia: { coordinates: [41.9028, 12.4964], timezone: 'Europe/Rome', label: 'Italia', flag: '🇮🇹' },
  jp: { coordinates: [35.6762, 139.6503], timezone: 'Asia/Tokyo', label: 'Japón', flag: '🇯🇵' },
  japon: { coordinates: [35.6762, 139.6503], timezone: 'Asia/Tokyo', label: 'Japón', flag: '🇯🇵' },
  japan: { coordinates: [35.6762, 139.6503], timezone: 'Asia/Tokyo', label: 'Japón', flag: '🇯🇵' },
  ec: { coordinates: [-0.1807, -78.4678], timezone: 'America/Guayaquil', label: 'Ecuador', flag: '🇪🇨' },
  ecuador: { coordinates: [-0.1807, -78.4678], timezone: 'America/Guayaquil', label: 'Ecuador', flag: '🇪🇨' },
  bo: { coordinates: [-16.4897, -68.1193], timezone: 'America/La_Paz', label: 'Bolivia', flag: '🇧🇴' },
  bolivia: { coordinates: [-16.4897, -68.1193], timezone: 'America/La_Paz', label: 'Bolivia', flag: '🇧🇴' },
  ve: { coordinates: [10.4806, -66.9036], timezone: 'America/Caracas', label: 'Venezuela', flag: '🇻🇪' },
  venezuela: { coordinates: [10.4806, -66.9036], timezone: 'America/Caracas', label: 'Venezuela', flag: '🇻🇪' },
  uy: { coordinates: [-34.9011, -56.1645], timezone: 'America/Montevideo', label: 'Uruguay', flag: '🇺🇾' },
  uruguay: { coordinates: [-34.9011, -56.1645], timezone: 'America/Montevideo', label: 'Uruguay', flag: '🇺🇾' },
  pa: { coordinates: [8.9824, -79.5199], timezone: 'America/Panama', label: 'Panamá', flag: '🇵🇦' },
  panama: { coordinates: [8.9824, -79.5199], timezone: 'America/Panama', label: 'Panamá', flag: '🇵🇦' },
  cr: { coordinates: [9.9281, -84.0907], timezone: 'America/Costa_Rica', label: 'Costa Rica', flag: '🇨🇷' },
  'costa rica': { coordinates: [9.9281, -84.0907], timezone: 'America/Costa_Rica', label: 'Costa Rica', flag: '🇨🇷' },
  cu: { coordinates: [23.1136, -82.3666], timezone: 'America/Havana', label: 'Cuba', flag: '🇨🇺' },
  cuba: { coordinates: [23.1136, -82.3666], timezone: 'America/Havana', label: 'Cuba', flag: '🇨🇺' },
  pt: { coordinates: [38.7223, -9.1393], timezone: 'Europe/Lisbon', label: 'Portugal', flag: '🇵🇹' },
  portugal: { coordinates: [38.7223, -9.1393], timezone: 'Europe/Lisbon', label: 'Portugal', flag: '🇵🇹' },
  nl: { coordinates: [52.3676, 4.9041], timezone: 'Europe/Amsterdam', label: 'Países Bajos', flag: '🇳🇱' },
  'paises bajos': { coordinates: [52.3676, 4.9041], timezone: 'Europe/Amsterdam', label: 'Países Bajos', flag: '🇳🇱' },
  au: { coordinates: [-33.8688, 151.2093], timezone: 'Australia/Sydney', label: 'Australia', flag: '🇦🇺' },
  australia: { coordinates: [-33.8688, 151.2093], timezone: 'Australia/Sydney', label: 'Australia', flag: '🇦🇺' },
  nz: { coordinates: [-36.8509, 174.7645], timezone: 'Pacific/Auckland', label: 'Nueva Zelanda', flag: '🇳🇿' },
  'nueva zelanda': { coordinates: [-36.8509, 174.7645], timezone: 'Pacific/Auckland', label: 'Nueva Zelanda', flag: '🇳🇿' },
  cn: { coordinates: [39.9042, 116.4074], timezone: 'Asia/Shanghai', label: 'China', flag: '🇨🇳' },
  china: { coordinates: [39.9042, 116.4074], timezone: 'Asia/Shanghai', label: 'China', flag: '🇨🇳' },
  kr: { coordinates: [37.5665, 126.978], timezone: 'Asia/Seoul', label: 'Corea del Sur', flag: '🇰🇷' },
  'corea del sur': { coordinates: [37.5665, 126.978], timezone: 'Asia/Seoul', label: 'Corea del Sur', flag: '🇰🇷' },
  in: { coordinates: [28.6139, 77.209], timezone: 'Asia/Kolkata', label: 'India', flag: '🇮🇳' },
  india: { coordinates: [28.6139, 77.209], timezone: 'Asia/Kolkata', label: 'India', flag: '🇮🇳' },
  ph: { coordinates: [14.5995, 120.9842], timezone: 'Asia/Manila', label: 'Filipinas', flag: '🇵🇭' },
  filipinas: { coordinates: [14.5995, 120.9842], timezone: 'Asia/Manila', label: 'Filipinas', flag: '🇵🇭' },
  philippines: { coordinates: [14.5995, 120.9842], timezone: 'Asia/Manila', label: 'Filipinas', flag: '🇵🇭' },
};

function normalizeCountry(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

function findCountryLocation(country: string) {
  const normalized = normalizeCountry(country);
  return COUNTRY_LOCATIONS[normalized]
    ?? Object.entries(COUNTRY_LOCATIONS).find(([key]) => key.length > 3 && normalized.includes(key))?.[1];
}

function formatLocalTime(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('es', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function createConnectionCurve(start: [number, number], end: [number, number]) {
  const midpointLongitude = (start[1] + end[1]) / 2;
  const control: [number, number] = [
    Math.min(75, (start[0] + end[0]) / 2 + 12),
    midpointLongitude,
  ];
  return Array.from({ length: 31 }, (_, index) => {
    const t = index / 30;
    const inverse = 1 - t;
    return [
      inverse * inverse * start[0] + 2 * inverse * t * control[0] + t * t * end[0],
      inverse * inverse * start[1] + 2 * inverse * t * control[1] + t * t * end[1],
    ] as [number, number];
  });
}

function resolveMember(member: RealmMember, user: SupabaseUser | null): ResolvedMember {
  const isCurrentUser = user?.id === member.user_id;
  const metadata = user?.user_metadata ?? {};
  const metadataName = typeof metadata.nickname === 'string'
    ? metadata.nickname
    : typeof metadata.username === 'string' ? metadata.username : '';
  const metadataCountry = typeof metadata.country === 'string' ? metadata.country : '';
  const metadataAvatar = typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null;
  const profileName = member.username.trim();
  const isRealmAdmin = isCurrentUser && user?.email?.toLowerCase() === ADMIN_EMAIL;

  return {
    ...member,
    displayName: isRealmAdmin
      ? 'Manuel'
      : profileName && profileName !== 'Jugador' ? profileName : metadataName.trim() || member.username,
    countryName: isRealmAdmin
      ? 'Colombia 🇨🇴'
      : (isCurrentUser && metadataCountry.trim()) || member.country,
    avatar: member.avatar_url || (isCurrentUser ? metadataAvatar : null),
  };
}

function distanceBetweenKm(start: [number, number], end: [number, number]) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDifference = toRadians(end[0] - start[0]);
  const longitudeDifference = toRadians(end[1] - start[1]);
  const startLatitude = toRadians(start[0]);
  const endLatitude = toRadians(end[0]);
  const haversine = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDifference / 2) ** 2;

  return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
}

function formatDistance(distanceKm: number) {
  return new Intl.NumberFormat('es', { maximumFractionDigits: 0 }).format(distanceKm);
}

export default function WorldMapHome({ user }: WorldMapHomeProps) {
  const [now, setNow] = useState(() => new Date());
  const [members, setMembers] = useState<RealmMember[]>([]);
  const [invitations, setInvitations] = useState<RealmInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(user));
  const [isAccepting, setIsAccepting] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadRealmData = useCallback(async () => {
    if (!user) {
      setMembers([]);
      setInvitations([]);
      setIsLoading(false);
      return;
    }

    try {
      const [nextMembers, nextInvitations] = await Promise.all([
        realmMembersService.getMembers(),
        user.email ? realmMembersService.getMyPendingInvitations(user.email) : Promise.resolve([]),
      ]);
      setMembers(nextMembers);
      setInvitations(nextInvitations);
      setStatusError(null);
    } catch (error) {
      console.error('Error al cargar miembros del Realm:', error);
      setStatusError('No se pudo cargar el Realm. Comprueba que la migración de miembros esté aplicada.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    setIsLoading(Boolean(user));
    void loadRealmData();
    const channel = user ? realmMembersService.subscribe(() => void loadRealmData()) : null;
    return () => {
      if (channel) void realmMembersService.unsubscribe(channel);
    };
  }, [loadRealmData, user]);

  const resolvedMembers = useMemo(
    () => members.map((member) => resolveMember(member, user)),
    [members, user],
  );
  const mappedMembers = useMemo(
    () => resolvedMembers.flatMap((member) => {
      const location = findCountryLocation(member.countryName);
      return location ? [{ member, location }] : [];
    }),
    [resolvedMembers],
  );
  const currentMember = mappedMembers.find(({ member }) => member.user_id === user?.id);
  const memberDistances = useMemo(() => {
    const distances: Array<{
      key: string;
      first: (typeof mappedMembers)[number];
      second: (typeof mappedMembers)[number];
      distanceKm: number;
    }> = [];

    for (let firstIndex = 0; firstIndex < mappedMembers.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < mappedMembers.length; secondIndex += 1) {
        const first = mappedMembers[firstIndex];
        const second = mappedMembers[secondIndex];
        distances.push({
          key: `${first.member.user_id}-${second.member.user_id}`,
          first,
          second,
          distanceKm: distanceBetweenKm(first.location.coordinates, second.location.coordinates),
        });
      }
    }

    return distances;
  }, [mappedMembers]);
  const connectionRoutes = currentMember
    ? mappedMembers
      .filter(({ member }) => member.user_id !== currentMember.member.user_id)
      .map(({ member, location }) => ({
        key: member.user_id,
        positions: createConnectionCurve(currentMember.location.coordinates, location.coordinates),
        distanceKm: distanceBetweenKm(currentMember.location.coordinates, location.coordinates),
        memberName: member.displayName,
      }))
    : [];
  const membersNotMapped = resolvedMembers.length - mappedMembers.length;

  async function handleAcceptInvitation(invitation: RealmInvitation) {
    setIsAccepting(invitation.id);
    setStatusError(null);
    setStatusMessage(null);
    try {
      await realmMembersService.acceptInvitation(invitation.id);
      await loadRealmData();
      setStatusMessage('¡Ya formas parte del Realm! El mapa se actualizará para todos.');
    } catch (error) {
      console.error('Error al aceptar invitación al Realm:', error);
      setStatusError(error instanceof Error ? error.message : 'No se pudo aceptar la invitación.');
    } finally {
      setIsAccepting(null);
    }
  }

  return (
    <section aria-labelledby="world-map-title" className="mx-auto w-full max-w-6xl space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-realm-border/80 bg-gradient-to-r from-violet-950/60 via-card to-pink-950/40 px-6 py-6 shadow-xl shadow-black/20 backdrop-blur-md sm:px-8">
        <div className="absolute -right-10 -top-20 h-56 w-56 rounded-full bg-pink-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-violet-300">
              <Compass className="h-3.5 w-3.5" />
              Un universo compartido
            </p>
            <h2 id="world-map-title" className="text-2xl font-extrabold text-slate-100 sm:text-3xl">El mapa del Realm</h2>
            <p className="mt-2 text-sm text-slate-400">Un lugar para conectar con las personas que invitas a tu aventura.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-violet-300/40 bg-white/60 px-4 py-2 text-xs text-violet-800">
            <Heart className="h-3.5 w-3.5 animate-pulse fill-pink-400/30 text-pink-300" />
            {isLoading ? 'Sincronizando Realm...' : `${resolvedMembers.length} ${resolvedMembers.length === 1 ? 'miembro' : 'miembros'} aceptados`}
          </div>
        </div>
        {statusError && <p role="alert" className="relative mt-3 text-xs text-amber-200">{statusError}</p>}
      </header>

      {invitations.length > 0 && (
        <section aria-label="Invitaciones pendientes" className="space-y-3">
          {invitations.map((invitation) => (
            <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-amber-400/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <UserPlus className="h-5 w-5 shrink-0 text-amber-200" />
                <p className="text-sm text-slate-200">Te invitaron al Realm. Acepta para unirte al mapa compartido.</p>
              </div>
              <button
                type="button"
                disabled={isAccepting === invitation.id}
                onClick={() => void handleAcceptInvitation(invitation)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-pink-500 px-4 py-2 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {isAccepting === invitation.id && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                Aceptar invitación
              </button>
            </div>
          ))}
        </section>
      )}
      {statusMessage && <p role="status" className="text-xs text-emerald-300">{statusMessage}</p>}

      <div className="realm-map-container relative overflow-hidden rounded-3xl border border-violet-400/15 shadow-2xl shadow-black/30">
        <MapContainer
          center={[18, -25]}
          zoom={2}
          minZoom={2}
          maxZoom={9}
          scrollWheelZoom={false}
          className="realm-leaflet-map"
          zoomControl
          attributionControl
        >
          <MapInvalidator />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            subdomains="abc"
            maxZoom={20}
            updateWhenIdle
            updateWhenZooming={false}
            keepBuffer={3}
            className="map-dark-filter"
          />

          {connectionRoutes.map((route) => (
            <Polyline
              key={route.key}
              positions={route.positions}
              pathOptions={{
                color: '#e879f9',
                weight: 2,
                opacity: 0.75,
                className: 'realm-connection-route',
              }}
            >
              <Tooltip sticky className="realm-map-tooltip">
                {formatDistance(route.distanceKm)} km hasta {route.memberName}
              </Tooltip>
            </Polyline>
          ))}

          {mappedMembers.map(({ member, location }) => {
            const isCurrentUser = member.user_id === user?.id;
            return (
              <CircleMarker
                key={member.user_id}
                center={location.coordinates}
                radius={isCurrentUser ? 9 : 8}
                pathOptions={{
                  color: isCurrentUser ? '#c4b5fd' : '#fbcfe8',
                  weight: 3,
                  fillColor: isCurrentUser ? '#8b5cf6' : '#ec4899',
                  fillOpacity: 1,
                  className: isCurrentUser
                    ? 'realm-player-marker realm-player-marker-current'
                    : 'realm-player-marker realm-player-marker-guest',
                }}
              >
                <Tooltip direction="top" offset={[0, -9]} permanent className="realm-map-tooltip">
                  {location.flag} {member.displayName} · {location.label}
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
        <div className="pointer-events-none absolute left-1/2 top-4 z-[500] -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full border border-violet-300/40 bg-slate-950/95 px-4 py-2 text-xs text-violet-900 shadow-lg backdrop-blur-md">
            <MapPin className="h-3.5 w-3.5 text-pink-300" />
            {mappedMembers.length} {mappedMembers.length === 1 ? 'persona en el mapa' : 'personas en el mapa'}
          </div>
        </div>
      </div>

      {memberDistances.length > 0 && (
        <section aria-labelledby="member-distances-title" className="space-y-3">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-pink-300" />
            <h3 id="member-distances-title" className="text-sm font-bold uppercase tracking-wider text-slate-200">Distancia entre miembros</h3>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">{memberDistances.length}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {memberDistances.map(({ key, first, second, distanceKm }) => (
              <article key={key} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-violet-300/15 bg-slate-950/70 px-4 py-3 shadow-lg shadow-violet-950/10">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-100">
                    {first.location.flag} {first.member.displayName}
                    <span className="mx-1.5 text-slate-600">↔</span>
                    {second.location.flag} {second.member.displayName}
                  </p>
                  <p className="mt-1 truncate text-[10px] text-slate-500">{first.location.label} · {second.location.label}</p>
                </div>
                <p className="shrink-0 rounded-xl border border-pink-300/15 bg-pink-400/5 px-2.5 py-1.5 font-mono text-xs font-bold text-pink-200">
                  ≈ {formatDistance(distanceKm)} km
                </p>
              </article>
            ))}
          </div>
          <p className="text-[10px] text-slate-500">Distancias aproximadas calculadas entre ubicaciones representativas de cada país.</p>
        </section>
      )}

      {membersNotMapped > 0 && (
        <p className="text-center text-xs text-amber-200/80">
          {membersNotMapped} {membersNotMapped === 1 ? 'miembro tiene' : 'miembros tienen'} una ubicación que aún no está representada en el mapa. Actualiza su país en Perfil.
        </p>
      )}

      {!user && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4 text-center text-sm text-slate-400">
          Inicia sesión en Perfil para ver los miembros de tu Realm y tus invitaciones.
        </div>
      )}
      <p className="text-center text-[10px] text-slate-500">Las posiciones del mapa son aproximadas y corresponden al país del perfil.</p>

      {isLoading ? (
        <p role="status" className="flex items-center justify-center gap-2 py-4 text-sm text-violet-200">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Cargando miembros...
        </p>
      ) : resolvedMembers.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resolvedMembers.map((member, index) => {
            const location = findCountryLocation(member.countryName);
            const isCurrentUser = member.user_id === user?.id;
            const localTime = location ? formatLocalTime(now, location.timezone) : null;
            return (
              <motion.article
                key={member.user_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3) }}
                className={`flex items-center gap-3 rounded-2xl border bg-slate-950/75 p-4 shadow-xl backdrop-blur-md ${
                  isCurrentUser ? 'border-violet-400/20 shadow-violet-950/20' : 'border-pink-400/20 shadow-pink-950/20'
                }`}
              >
                <div className={`h-12 w-12 shrink-0 overflow-hidden rounded-2xl border bg-slate-900 ${
                  isCurrentUser ? 'border-violet-300/40' : 'border-pink-300/30'
                }`}>
                  {member.avatar
                    ? <img src={member.avatar} alt={`Avatar de ${member.displayName}`} className="h-full w-full object-cover" />
                    : <div className="flex h-full w-full items-center justify-center font-bold text-violet-200">{member.displayName.charAt(0).toUpperCase()}</div>}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-100">
                    <span className="text-slate-100">{member.displayName}</span>{isCurrentUser ? <span className="ml-1 text-[10px] font-normal text-violet-700">(tú)</span> : null}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {location ? `${location.flag} ${location.label}` : member.country || 'Ubicación sin configurar'}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1.5 font-mono text-[11px] text-violet-200">
                    <Clock className="h-3 w-3" />
                    {localTime ?? 'Hora local no disponible'}
                  </p>
                </div>
              </motion.article>
            );
          })}
        </div>
      ) : !isLoading && user ? (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 px-6 py-10 text-center">
          <UserPlus className="mx-auto mb-3 h-7 w-7 text-slate-600" />
          <p className="text-sm text-slate-400">Todavía no perteneces a ningún Realm.</p>
          <p className="mt-1 text-xs text-slate-500">Cuando te inviten, podrás aceptar la invitación aquí.</p>
        </div>
      ) : null}

      <div className="flex items-center justify-center gap-2 pb-2 text-center text-xs text-slate-500">
        <Sparkles className="h-3.5 w-3.5 text-amber-300/70" />
        <span>La distancia no impide compartir una aventura.</span>
      </div>
    </section>
  );
}
