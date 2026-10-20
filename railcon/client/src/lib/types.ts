// Shared TypeScript interfaces for RailCon client-server communication

export interface User {
  id: string;
  forteId: string;
  name: string;
  role: 'DRIVER' | 'DISPATCHER' | 'SYSADMIN';
  createdAt: string;
}

export interface Station {
  id: string;
  name: string;
  code: string;
}

export interface Route {
  id: string;
  name: string;
  description?: string;
  stops: RouteStop[];
  timetables: Timetable[];
}

export interface RouteStop {
  routeId: string;
  stationId: string;
  stopSequenceIndex: number;
  station: Station;
}

export interface Timetable {
  id: string;
  routeId: string;
  runNumber: string;
  startTime: string;
  endTime: string;
  direction: 1 | 2;
  route: Route;
  stops: TimetableStop[];
}

export interface TimetableStop {
  id: string;
  timetableId: string;
  stationId: string;
  stopSequenceIndex: number;
  scheduledArrival: string | null;
  scheduledDeparture: string | null;
  station: Station;
}

export interface ActiveSession {
  id: string;
  clientId: string;
  driverId: string | null;
  timetableId: string | null;
  currentStopIndex: number;
  delayMinutes: number;
  status: 'ACTIVE' | 'IDLE' | 'NON_ACTIVE';
  createdAt: string;
  updatedAt: string;
  driver?: User | null;
  timetable?: Timetable | null;
}

export interface Message {
  id: string;
  senderId: string | null;
  receiverClientId: string;
  content: string;
  type: 'STATUS' | 'DISPATCH_POPUP' | 'PANIC';
  timestamp: string;
  acknowledged: boolean;
  sender?: User | null;
}

export interface CannedOption {
  id: string;
  category: 'DRIVER_TO_DISPATCH' | 'PASSENGER_ANNOUNCEMENT';
  label: string;
  templateText: string;
  displayOrder: number;
}

export interface FleetData {
  active: ActiveSession[];
  idle: ActiveSession[];
  nonActive: ActiveSession[];
  total: number;
}

export interface LoginRequest {
  pin: string;
  forteId: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    forteId: string;
    role: string;
  };
}

export interface RegisterClientRequest {
  clientId: string;
  driverId?: string;
  timetableId?: string;
}

export interface SessionUpdateRequest {
  driverId?: string;
  timetableId?: string;
  currentStopIndex?: number;
  delayMinutes?: number;
  status?: 'ACTIVE' | 'IDLE' | 'NON_ACTIVE';
}

export interface SendMessageRequest {
  receiverClientId: string;
  content: string;
  type: 'STATUS' | 'DISPATCH_POPUP' | 'PANIC';
}

export interface BroadcastRequest {
  clientIds?: string[];
  role?: 'DRIVER' | 'DISPATCHER' | 'SYSADMIN';
  content: string;
  type: 'STATUS' | 'DISPATCH_POPUP' | 'PANIC';
  duration?: number;
}

export interface TruncateStopsRequest {
  clientId: string;
  newStopIndex: number;
}

export interface ScheduleOverrideRequest {
  clientId: string;
  delayMinutes: number;
}

export interface ReliefRunRequest {
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
}

export interface DoorToggleRequest {
  doorOpen: boolean;
}

export interface PositionUpdate {
  stopIndex: number;
  delayMinutes: number;
}

export interface PanicAlert {
  clientId: string;
  driverName: string;
  driverId: string;
  timestamp: string;
}

export interface DispatchPopup {
  message: Message;
  duration: number;
}

export interface StopAdvanced {
  stopIndex: number;
}

export interface StopsTruncated {
  newStopIndex: number;
}

export interface ScheduleOverride {
  delayMinutes: number;
}

export interface SessionTerminated {
  clientId: string;
}

export interface SessionUpdated {
  session: ActiveSession;
}

export interface FleetUpdate {
  type: 'SESSION_UPDATED' | 'SESSION_TERMINATED' | 'STOP_ADVANCED' | 'STOPS_TRUNCATED' | 'SCHEDULE_OVERRIDE' | 'RELIEF_RUN_CREATED';
  session?: ActiveSession;
  clientId?: string;
  stopIndex?: number;
  newStopIndex?: number;
  delayMinutes?: number;
  timetable?: Timetable;
}

export interface PISData {
  session: ActiveSession | null;
}

export interface GTFSImportRequest {
  gtfsPath: string;
}

export interface CSVImportRequest {
  csvPath: string;
}

export interface ApiError {
  error: string;
}

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

export type WebSocketEvent =
  | { event: 'register-client'; data: string }
  | { event: 'update-position'; data: PositionUpdate }
  | { event: 'send-message'; data: SendMessageRequest }
  | { event: 'acknowledge-message'; data: string }
  | { event: 'panic'; data: undefined }
  | { event: 'session-updated'; data: ActiveSession }
  | { event: 'stop-advanced'; data: StopAdvanced }
  | { event: 'door-state-changed'; data: DoorToggleRequest }
  | { event: 'new-message'; data: Message }
  | { event: 'message-sent'; data: Message }
  | { event: 'dispatch-popup'; data: DispatchPopup }
  | { event: 'stops-truncated'; data: StopsTruncated }
  | { event: 'schedule-override'; data: ScheduleOverride }
  | { event: 'panic-alert'; data: PanicAlert }
  | { event: 'fleet-update'; data: FleetUpdate }
  | { event: 'session-terminated'; data: SessionTerminated }
  | { event: 'message-queued'; data: { message: Message; receiverClientId: string } };

export interface WebSocketMessage<T = any> {
  event: string;
  data: T;
}
