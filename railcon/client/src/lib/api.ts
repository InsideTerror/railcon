// RailCon API Client - REST + WebSocket communication layer

import { io, Socket } from 'socket.io-client';
import type {
  User,
  Station,
  Route,
  Timetable,
  ActiveSession,
  Message,
  CannedOption,
  FleetData,
  LoginRequest,
  LoginResponse,
  RegisterClientRequest,
  SessionUpdateRequest,
  SendMessageRequest,
  BroadcastRequest,
  TruncateStopsRequest,
  ScheduleOverrideRequest,
  ReliefRunRequest,
  PositionUpdate,
  GTFSImportRequest,
  CSVImportRequest,
  HealthResponse,
  ApiError,
  WebSocketMessage,
} from './types';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || '/api';
const WS_BASE = (import.meta as any).env?.VITE_WS_BASE || '/ws';

class ApiClient {
  private token: string | null = null;
  private ws: Socket | null = null;
  private wsReconnectAttempts = 0;
  private wsMaxReconnectAttempts = 5;
  private wsReconnectDelay = 1000;
  private eventHandlers: Map<string, Set<(data: any) => void>> = new Map();
  private clientId: string | null = null;

  // Authentication
  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // Auth endpoints
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    this.setToken(response.token);
    return response;
  }

  async getMe(): Promise<{ user: User }> {
    return this.request('/auth/me');
  }

  async registerClient(data: RegisterClientRequest): Promise<{ session: ActiveSession }> {
    return this.request('/auth/register-client', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Session endpoints
  async getSessions(): Promise<{ sessions: ActiveSession[] }> {
    return this.request('/sessions');
  }

  async getSession(clientId: string): Promise<{ session: ActiveSession }> {
    return this.request(`/sessions/${clientId}`);
  }

  async updateSession(clientId: string, data: SessionUpdateRequest): Promise<{ session: ActiveSession }> {
    return this.request(`/sessions/${clientId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteSession(clientId: string): Promise<{ success: boolean }> {
    return this.request(`/sessions/${clientId}`, {
      method: 'DELETE',
    });
  }

  async advanceStop(clientId: string): Promise<{ session: ActiveSession }> {
    return this.request(`/sessions/${clientId}/advance-stop`, {
      method: 'POST',
    });
  }

  async toggleDoor(clientId: string, doorOpen: boolean): Promise<{ success: boolean; doorOpen: boolean }> {
    return this.request(`/sessions/${clientId}/door-toggle`, {
      method: 'POST',
      body: JSON.stringify({ doorOpen }),
    });
  }

  // Message endpoints
  async getMessages(params?: {
    clientId?: string;
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ messages: Message[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.clientId) searchParams.set('clientId', params.clientId);
    if (params?.type) searchParams.set('type', params.type);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));

    const query = searchParams.toString();
    return this.request(`/messages${query ? `?${query}` : ''}`);
  }

  async sendMessage(data: SendMessageRequest): Promise<{ message: Message }> {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async acknowledgeMessage(id: string): Promise<{ message: Message }> {
    return this.request(`/messages/${id}/acknowledge`, {
      method: 'PATCH',
    });
  }

  async getCannedOptions(): Promise<{ options: CannedOption[] }> {
    return this.request('/canned-options');
  }

  // Route endpoints
  async getRoutes(): Promise<{ routes: Route[] }> {
    return this.request('/routes');
  }

  async getRoute(id: string): Promise<{ route: Route }> {
    return this.request(`/routes/${id}`);
  }

  async createRoute(data: {
    id: string;
    name: string;
    description?: string;
    stops?: Array<{ stationId: string; stopSequenceIndex: number }>;
  }): Promise<{ route: Route }> {
    return this.request('/routes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRoute(id: string, data: { name?: string; description?: string }): Promise<{ route: Route }> {
    return this.request(`/routes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteRoute(id: string): Promise<{ success: boolean }> {
    return this.request(`/routes/${id}`, {
      method: 'DELETE',
    });
  }

  // Timetable endpoints
  async getTimetables(params?: { routeId?: string; direction?: number }): Promise<{ timetables: Timetable[] }> {
    const searchParams = new URLSearchParams();
    if (params?.routeId) searchParams.set('routeId', params.routeId);
    if (params?.direction) searchParams.set('direction', String(params.direction));

    const query = searchParams.toString();
    return this.request(`/timetables${query ? `?${query}` : ''}`);
  }

  async getTimetable(id: string): Promise<{ timetable: Timetable }> {
    return this.request(`/timetables/${id}`);
  }

  async createTimetable(data: {
    routeId: string;
    runNumber: string;
    startTime: string;
    endTime: string;
    direction: 1 | 2;
    stops: Array<{
      stationId: string;
      stopSequenceIndex: number;
      scheduledArrival?: string;
      scheduledDeparture?: string;
    }>;
  }): Promise<{ timetable: Timetable }> {
    return this.request('/timetables', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTimetable(id: string, data: {
    runNumber?: string;
    startTime?: string;
    endTime?: string;
    direction?: 1 | 2;
  }): Promise<{ timetable: Timetable }> {
    return this.request(`/timetables/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTimetable(id: string): Promise<{ success: boolean }> {
    return this.request(`/timetables/${id}`, {
      method: 'DELETE',
    });
  }

  // Station endpoints
  async getStations(): Promise<{ stations: Station[] }> {
    return this.request('/stations');
  }

  async getStation(id: string): Promise<{ station: Station }> {
    return this.request(`/stations/${id}`);
  }

  async createStation(data: { name: string; code: string }): Promise<{ station: Station }> {
    return this.request('/stations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateStation(id: string, data: { name?: string; code?: string }): Promise<{ station: Station }> {
    return this.request(`/stations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteStation(id: string): Promise<{ success: boolean }> {
    return this.request(`/stations/${id}`, {
      method: 'DELETE',
    });
  }

  // Dispatcher endpoints
  async getFleet(): Promise<FleetData> {
    return this.request('/dispatcher/fleet');
  }

  async broadcast(data: BroadcastRequest): Promise<{ success: boolean; message: Message }> {
    return this.request('/dispatcher/broadcast', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async truncateStops(data: TruncateStopsRequest): Promise<{ success: boolean }> {
    return this.request('/dispatcher/truncate-stops', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async scheduleOverride(data: ScheduleOverrideRequest): Promise<{ success: boolean }> {
    return this.request('/dispatcher/schedule-override', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createReliefRun(data: ReliefRunRequest): Promise<{ timetable: Timetable }> {
    return this.request('/dispatcher/relief-run', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async terminateSession(clientId: string): Promise<{ success: boolean }> {
    return this.request('/dispatcher/terminate-session', {
      method: 'POST',
      body: JSON.stringify({ clientId }),
    });
  }

  // GTFS/CSV Import endpoints
  async importGTFS(data: GTFSImportRequest): Promise<{ success: boolean; message: string }> {
    return this.request('/gtfs/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async importCSV(data: CSVImportRequest): Promise<{ success: boolean; message: string; count: number }> {
    return this.request('/csv/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Admin endpoints
  async getUsers(): Promise<{ users: User[] }> {
    return this.request('/admin/users');
  }

  async createUser(data: {
    pin: string;
    forteId: string;
    name: string;
    role: 'DRIVER' | 'DISPATCHER' | 'SYSADMIN';
  }): Promise<{ user: User }> {
    return this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: string, data: {
    name?: string;
    role?: 'DRIVER' | 'DISPATCHER' | 'SYSADMIN';
    pin?: string;
  }): Promise<{ user: User }> {
    return this.request(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id: string): Promise<{ success: boolean }> {
    return this.request(`/admin/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Health check
  async health(): Promise<HealthResponse> {
    return this.request('/health');
  }

  // WebSocket connection
  connectWebSocket(clientId: string): Promise<void> {
    this.clientId = clientId;
    return new Promise((resolve, reject) => {
      const serverUrl = `${window.location.protocol === 'https:' ? 'https:' : 'http:'}//${window.location.host}`;
      this.ws = io(serverUrl, {
        path: '/ws',
        auth: { token: localStorage.getItem('token') || '' },
        transports: ['websocket', 'polling'],
      });

      this.ws.on('connect', () => {
        console.log('[WS] Connected');
        this.wsReconnectAttempts = 0;
        this.sendWS('register-client', clientId);
        resolve();
      });

      this.ws.onAny((type, data) => {
        this.handleWSMessage({ type, payload: data });
      });

      this.ws.on('connect_error', (error) => {
        console.error('[WS] Connection error:', error);
        if (this.wsReconnectAttempts === 0) {
          reject(error);
        }
      });

      this.ws.on('disconnect', (reason) => {
        console.log('[WS] Disconnected:', reason);
        this.attemptReconnect();
      });
    });
  }

  private attemptReconnect() {
    if (this.wsReconnectAttempts >= this.wsMaxReconnectAttempts) {
      console.error('[WS] Max reconnect attempts reached');
      return;
    }

    this.wsReconnectAttempts++;
    const delay = this.wsReconnectDelay * Math.pow(2, this.wsReconnectAttempts - 1);
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.wsReconnectAttempts})`);

    setTimeout(() => {
      if (this.clientId) {
        this.connectWebSocket(this.clientId).catch(() => {});
      }
    }, delay);
  }

  private handleWSMessage(message: { type: string; payload: any }) {
    const handlers = this.eventHandlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => handler(message.payload));
    }
  }

  sendWS(event: string, data: any) {
    if (this.ws && this.ws.connected) {
      this.ws.emit(event, data);
    } else {
      console.warn('[WS] Cannot send, socket not connected');
    }
  }

  onWSMessage<T>(event: string, handler: (data: T) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);

    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  disconnectWebSocket() {
    if (this.ws) {
      this.ws.disconnect();
      this.ws = null;
    }
    this.eventHandlers.clear();
  }

  // Convenience methods for common WebSocket events
  sendPositionUpdate(data: PositionUpdate) {
    this.sendWS('update-position', data);
  }

  sendMessageWS(data: SendMessageRequest) {
    this.sendWS('send-message', data);
  }

  acknowledgeMessageWS(messageId: string) {
    this.sendWS('acknowledge-message', messageId);
  }

  sendPanic() {
    this.sendWS('panic', undefined);
  }

  toggleDoorWS(doorOpen: boolean) {
    this.sendWS('door-state-changed', { doorOpen });
  }
}

export const api = new ApiClient();
export default api;
