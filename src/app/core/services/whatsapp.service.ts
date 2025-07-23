import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ConversationFlow } from '../models/conversation-flow.model';

// Import environment configuration
import { environment } from '../../../environments/environment';

// ======= Interfaces =======
export interface Contact {
  id: string;
  name: string;
  phone: string;
  source: 'excel_import' | 'manual' | 'api';
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
  unreadCount?: number;
}

export interface Message {
  id: string;
  to: string;
  from: string;
  message: string;
  mediaUrl?: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
  error?: string;
}

export interface Campaign {
  id: string;
  name: string;
  message: string;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed' | 'paused';
  contacts: string[];
  sent: number;
  failed: number;
  total: number;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  error?: string;
}

export interface ExcelBroadcastResponse {
  success: boolean;
  message: string;
  total: number;
  sent: number;
  failed: number;
  results: Array<{
    phone: string;
    name?: string;
    status: 'sent' | 'failed';
    error?: string;
    messageId?: string;
  }>;
}

export interface Settings {
  id: string;
  businessName: string;
  businessHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timeZone: string;
    awayMessage: string;
  };
  autoReply: {
    enabled: boolean;
    message: string;
  };
  messageDelay: number;
  maxRetries: number;
  webhookUrl?: string;
  webhookEvents: string[];
  conversationFlow?: {
    enabled: boolean;
    initialMessage: string;
    options: Array<{
      id: string;
      label: string;
      response: string;
    }>;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class WhatsappService {
  private apiUrl = environment.apiUrl;

  // Connection status observable
  private connectionStatusSubject = new BehaviorSubject<{
    connected: boolean;
    qrCode?: string;
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    error?: string;
  }>({ connected: false, status: 'disconnected' });

  // Public observable for components to subscribe to
  connectionStatus$ = this.connectionStatusSubject.asObservable();

  constructor(private http: HttpClient) {
    console.log(`WhatsApp Service initialized with API URL: ${this.apiUrl}`);
  }

  // ======= Connection Methods =======
  private updateConnectionStatus(status: Partial<{
    connected: boolean;
    qrCode?: string;
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    error?: string;
  }>): void {
    this.connectionStatusSubject.next({
      ...this.connectionStatusSubject.value,
      ...status
    });
  }

  /**
   * Check WhatsApp connection status
   * @returns Observable with connection status
   */
  checkConnection(): Observable<{ connected: boolean; status: string }> {
    return this.http.get<{ connected: boolean; status: string }>(`${this.apiUrl}/status`)
      .pipe(catchError(this.handleError));
  }

  // Connect to WhatsApp
  connect(): Observable<{ qrCode?: string; status: string; success?: boolean; message?: string }> {
    return this.http.post<{ qrCode?: string; status: string; success?: boolean; message?: string }>(`${this.apiUrl}/connect`, {})
      .pipe(
        map(response => {
          if (response.status === 'connecting') {
            this.updateConnectionStatus({
              status: 'connecting',
              connected: false,
              qrCode: undefined
            });
          } else if (response.status === 'connected') {
            this.updateConnectionStatus({
              status: 'connected',
              connected: true,
              qrCode: undefined
            });
          }
          return response;
        }),
        catchError(this.handleError)
      );
  }

  // Disconnect from WhatsApp
  disconnect(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/disconnect`, {})
      .pipe(
        map(response => {
          this.updateConnectionStatus({
            status: 'disconnected',
            connected: false,
            qrCode: undefined
          });
          return response;
        }),
        catchError(this.handleError)
      );
  }

  // Generate new QR code
  generateQR(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/generate-qr`, {})
      .pipe(
        map(response => {
          if (response.success) {
            this.updateConnectionStatus({
              status: 'connecting',
              connected: false,
              qrCode: undefined
            });
          }
          return response;
        }),
        catchError(this.handleError)
      );
  }



  // ======= Conversation Flow Methods =======
  getConversationFlows(): Observable<ConversationFlow[]> {
    return this.http.get<ConversationFlow[]>(`${this.apiUrl}/conversation-flows`)
      .pipe(catchError(this.handleError));
  }

  getConversationFlow(id: string): Observable<ConversationFlow> {
    return this.http.get<ConversationFlow>(`${this.apiUrl}/conversation-flows/${id}`)
      .pipe(catchError(this.handleError));
  }

  createConversationFlow(flow: Omit<ConversationFlow, 'id' | 'createdAt' | 'updatedAt'>): Observable<ConversationFlow> {
    return this.http.post<ConversationFlow>(`${this.apiUrl}/conversation-flows`, flow)
      .pipe(catchError(this.handleError));
  }

  updateConversationFlow(id: string, flow: Partial<ConversationFlow>): Observable<ConversationFlow> {
    return this.http.put<ConversationFlow>(`${this.apiUrl}/conversation-flows/${id}`, flow)
      .pipe(catchError(this.handleError));
  }

  // ======= Campaign Methods =======
  getCampaigns(): Observable<Campaign[]> {
    return this.http.get<Campaign[]>(`${this.apiUrl}/campaigns`)
      .pipe(catchError(this.handleError));
  }

  getCampaign(id: string): Observable<Campaign> {
    return this.http.get<Campaign>(`${this.apiUrl}/campaigns/${id}`)
      .pipe(catchError(this.handleError));
  }

  createCampaign(campaign: Omit<Campaign, 'id' | 'status' | 'sent' | 'failed' | 'createdAt' | 'updatedAt'>): Observable<Campaign> {
    return this.http.post<Campaign>(`${this.apiUrl}/campaigns`, campaign)
      .pipe(catchError(this.handleError));
  }

  updateCampaign(id: string, campaign: Partial<Campaign>): Observable<Campaign> {
    return this.http.put<Campaign>(`${this.apiUrl}/campaigns/${id}`, campaign)
      .pipe(catchError(this.handleError));
  }

  deleteCampaign(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/campaigns/${id}`)
      .pipe(catchError(this.handleError));
  }

  // ======= Contact Methods =======
  getContacts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    source?: string;
  }): Observable<PaginatedResponse<Contact>> {
    let queryParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams = queryParams.append(key, value.toString());
        }
      });
    }

    return this.http.get<PaginatedResponse<Contact>>(`${this.apiUrl}/contacts`, { params: queryParams })
      .pipe(catchError(this.handleError));
  }

  getContact(id: string): Observable<Contact> {
    return this.http.get<Contact>(`${this.apiUrl}/contacts/${id}`)
      .pipe(catchError(this.handleError));
  }

  createContact(contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Observable<Contact> {
    return this.http.post<Contact>(`${this.apiUrl}/contacts`, contact)
      .pipe(catchError(this.handleError));
  }

  updateContact(id: string, contact: Partial<Contact>): Observable<Contact> {
    return this.http.put<Contact>(`${this.apiUrl}/contacts/${id}`, contact)
      .pipe(catchError(this.handleError));
  }

  deleteContact(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/contacts/${id}`)
      .pipe(catchError(this.handleError));
  }

  importContacts(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post(`${this.apiUrl}/contacts/import`, formData)
      .pipe(catchError(this.handleError));
  }

  downloadTemplate(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/download-template`, { 
      responseType: 'blob' 
    }).pipe(catchError(this.handleError));
  }

  // ======= Message Methods =======
  getMessages(contactId?: string): Observable<Message[]> {
    let params = new HttpParams();
    if (contactId) {
      params = params.set('contactId', contactId);
    }

    return this.http.get<ApiResponse<Message[]>>(`${this.apiUrl}/messages`, { params })
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  sendMessage(phone: string, message: string, mediaUrl?: string): Observable<Message> {
    const payload = { phone, message, mediaUrl };
    return this.http.post<ApiResponse<Message>>(`${this.apiUrl}/messages`, payload).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  sendExcelBroadcast(formData: FormData): Observable<ExcelBroadcastResponse> {
    console.log('Sending excel broadcast to:', `${this.apiUrl}/send-excel-broadcast`);
    
    // Log formData contents
    console.log('FormData contents:');
    formData.forEach((value, key) => {
      console.log(`${key}:`, value);
    });
    
    return this.http.post<any>(
      `${this.apiUrl}/send-excel-broadcast`,
      formData,
      {
        headers: {
          // No set Content-Type header, let the browser set it with the correct boundary for FormData
        },
        reportProgress: true
      }
    ).pipe(
      map(response => {
        console.log('Excel broadcast response:', response);
        return response.data || response;
      }),
      catchError(error => {
        console.error('Error in excel broadcast:', error);
        return throwError(() => new Error('Error al enviar mensajes: ' + (error.message || 'Error desconocido')));
      })
    );
  }

  sendBroadcast(phones: string[], message: string, file?: File): Observable<{ success: boolean; message: string }> {
    console.log('Sending broadcast to:', `${this.apiUrl}/campaigns`);
    console.log('Phones:', phones);
    console.log('Message:', message);
    
    const formData = new FormData();
    formData.append('phones', JSON.stringify(phones));
    formData.append('message', message);

    if (file) {
      console.log('With media file:', file.name);
      formData.append('media', file);
    }

    return this.http.post<any>(
      `${this.apiUrl}/campaigns`,
      formData
    ).pipe(
      map(response => {
        console.log('Broadcast response:', response);
        return response.data || response;
      }),
      catchError(error => {
        console.error('Error in broadcast:', error);
        return throwError(() => new Error('Error al enviar mensajes: ' + error.message));
      })
    );
  }

  // ======= Dashboard Methods =======
  getDashboardStats(): Observable<{
    totalContacts: number;
    totalMessages: number;
    campaigns: { total: number; completed: number; inProgress: number };
    unreadMessages: number;
  }> {
    console.log('🔄 Fetching dashboard stats from:', `${this.apiUrl}/dashboard/stats`);
    
    return this.http.get<{
      success: boolean;
      data: {
        totalContacts: number;
        totalMessages: number;
        campaigns: { total: number; completed: number; inProgress: number };
        unreadMessages: number;
        messageTrends?: any[];
        recentMessages?: any[];
        deliveryRate?: number;
      }
    }>(`${this.apiUrl}/dashboard/stats`)
      .pipe(
        map(response => {
          console.log('📊 Dashboard stats response:', response);
          if (response.success && response.data) {
            return response.data;
          } else {
            console.warn('⚠️ Invalid response format:', response);
            return {
              totalContacts: 0,
              totalMessages: 0,
              campaigns: { total: 0, completed: 0, inProgress: 0 },
              unreadMessages: 0
            };
          }
        }),
        catchError((error) => {
          console.error('❌ Error fetching dashboard stats:', error);
          // Return default values if API fails
          return of({
            totalContacts: 0,
            totalMessages: 0,
            campaigns: { total: 0, completed: 0, inProgress: 0 },
            unreadMessages: 0
          });
        })
      );
  }

  getQrStatus(): Observable<{
    needsQR: boolean; qrCode?: string; status: string; connected?: boolean
  }> {
    console.log('🔄 Checking QR status from:', `${this.apiUrl}/qr-status`);
    
    return this.http.get<any>(`${this.apiUrl}/qr-status`)
      .pipe(
        map(response => {
          console.log('📱 QR Status response:', response);
          
          if (response.success) {
            // Manejar el formato de respuesta del servidor
            const result = {
              qrCode: response.data?.qrCode || undefined,
              status: response.data?.isClientReady ? 'connected' : 'disconnected',
              connected: response.data?.isClientReady || false,
              needsQR: response.data?.needsQR || (!response.data?.isClientReady && !response.data?.qrCode)
            };
            console.log('📱 Processed QR status:', result);
            return result;
          } else {
            console.warn('⚠️ Invalid QR status response:', response);
            return { status: 'disconnected', connected: false, needsQR: true };
          }
        }),
        catchError((error) => {
          console.error('❌ Error checking QR status:', error);
          return of({ status: 'disconnected', connected: false, needsQR: true });
        })
      );
  }

  // ======= Contacts Methods =======
  getContactsPaginated(
    page: number = 1,
    limit: number = 10,
    search: string = ''
  ): Observable<{ data: Contact[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    if (search) {
      params = params.set('search', search);
    }

    return this.http.get<ApiResponse<{
      data: Contact[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>>(`${this.apiUrl}/contacts/paginated`, { params })
      .pipe(
        map(response => ({
          data: response.data.data,
          pagination: response.data.pagination
        })),
        catchError(this.handleError)
      );
  }

  // ======= Settings Methods =======
  getSettings(): Observable<Settings> {
    return this.http.get<ApiResponse<Settings>>(`${this.apiUrl}/settings`)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  updateSettings(settings: Partial<Settings>): Observable<Settings> {
    return this.http.put<ApiResponse<Settings>>(`${this.apiUrl}/settings`, settings)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  // ======= Utility Methods =======
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;

      // Try to get error details from the response
      if (error.error && error.error.message) {
        errorMessage = error.error.message;
      } else if (error.status === 0) {
        errorMessage = 'No se pudo conectar al servidor. Verifique su conexión a internet.';
      } else if (error.status === 401) {
        errorMessage = 'No autorizado. Por favor inicie sesión nuevamente.';
      } else if (error.status === 404) {
        errorMessage = 'Recurso no encontrado.';
      } else if (error.status >= 500) {
        errorMessage = 'Error interno del servidor. Por favor intente más tarde.';
      }
    }

    console.error('Error en WhatsAppService:', error);
    return throwError(() => new Error(errorMessage));
  }
}
