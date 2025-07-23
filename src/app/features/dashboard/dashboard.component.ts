import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WhatsappService } from '../../core/services/whatsapp.service';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  status: any = null;
  qrData: string | null = null;
  isLoading = true;
  errorMsg = '';
  isConnected = false;
  needsQR = false;
  isDisconnecting = false;
  isGeneratingQR = false;
  private qrCheckSubscription?: Subscription;

  constructor(private whatsappService: WhatsappService) { }

  ngOnInit(): void {
    this.loadDashboardData();
    this.startQrPolling();
  }

  ngOnDestroy(): void {
    if (this.qrCheckSubscription) {
      this.qrCheckSubscription.unsubscribe();
    }
  }

  private loadDashboardData(): void {
    this.isLoading = true;
    this.whatsappService.getDashboardStats().subscribe({
      next: (stats: any) => {
        this.status = {
          ...stats,
          connected: this.isConnected
        };
        this.isLoading = false;
      },
      error: (err: any) => {
        console.warn('Dashboard stats endpoint not available, using default values');
        this.status = {
          connected: this.isConnected,
          totalContacts: 0,
          totalMessages: 0,
          campaigns: { total: 0, completed: 0, inProgress: 0 },
          unreadMessages: 0
        };
        this.isLoading = false;
      }
    });
  }

  private startQrPolling(): void {
    // Verificar QR inmediatamente
    this.checkQrStatus();

    // Verificar QR cada 3 segundos
    this.qrCheckSubscription = interval(3000).subscribe(() => {
      this.checkQrStatus();
    });
  }

  private checkQrStatus(): void {
    this.whatsappService.getQrStatus().subscribe({
      next: (qrStatus: any) => {
        const wasConnected = this.isConnected;
        this.isConnected = qrStatus.connected || false;
        this.needsQR = qrStatus.needsQR || false;

        console.log('QR Status Response:', qrStatus);

        // Procesar el código QR
        if (qrStatus.qrCode) {
          console.log('QR Code received');

          // Verificar si el QR ya es una URL de datos completa
          if (qrStatus.qrCode.startsWith('data:image/')) {
            console.log('QR is already a data URL, using directly');
            this.qrData = qrStatus.qrCode;
          } else {
            // Usar la API de Google Charts para generar el QR directamente
            console.log('Converting QR code to image URL');
            this.qrData = 'https://chart.googleapis.com/chart?cht=qr&chl=' +
              encodeURIComponent(qrStatus.qrCode) +
              '&chs=300x300&chld=H|0';
          }
          // Verificar que this.qrData no sea null antes de usar substring
          if (this.qrData) {
            console.log('QR Data URL:', this.qrData.substring(0, 50) + '...');
          }
        } else {
          this.qrData = null;
        }

        // Actualizar el estado en el dashboard
        if (this.status) {
          this.status.connected = this.isConnected;
        }

        // Si cambió el estado de conexión, recargar datos
        if (wasConnected !== this.isConnected) {
          console.log('Connection status changed, reloading dashboard data');
          this.loadDashboardData();
        }

        // Si se conectó, detener el polling del QR
        if (this.isConnected && this.qrCheckSubscription) {
          console.log('WhatsApp connected, stopping QR polling');
          this.qrCheckSubscription.unsubscribe();
          this.qrData = null;
          this.needsQR = false;
        }

        // Si se desconectó y no hay QR, necesita generar uno
        if (!this.isConnected && !this.qrData && !this.needsQR) {
          this.needsQR = true;
        }
      },
      error: (err: any) => {
        console.error('Error checking QR status:', err);
        this.isConnected = false;
        this.needsQR = true;
        this.qrData = null;
        this.errorMsg = 'Error al obtener el estado del QR';
      }
    });
  }

  refreshQr(): void {
    this.qrData = null;
    this.checkQrStatus();
  }

  disconnectWhatsApp(): void {
    if (!confirm('¿Estás seguro de que quieres desconectar WhatsApp? Se cerrará la sesión actual y tendrás que escanear un nuevo código QR para reconectar.')) {
      return;
    }

    this.isDisconnecting = true;
    this.errorMsg = '';

    this.whatsappService.disconnect().subscribe({
      next: (response: any) => {
        console.log('WhatsApp desconectado exitosamente:', response);

        // Resetear estado inmediatamente
        this.isConnected = false;
        this.needsQR = false;
        this.qrData = null;
        this.isDisconnecting = false;

        // Detener polling actual si existe
        if (this.qrCheckSubscription) {
          this.qrCheckSubscription.unsubscribe();
        }

        // Mostrar mensaje de éxito
        this.errorMsg = '';
        console.log('✅ Desconexión completada. Usa "Generar Nuevo QR" para conectar otra cuenta.');
      },
      error: (error: any) => {
        console.error('Error al desconectar WhatsApp:', error);
        this.errorMsg = 'Error al desconectar WhatsApp: ' + error.message;
        this.isDisconnecting = false;
      }
    });
  }

  generateNewQR(): void {
    this.isGeneratingQR = true;
    this.errorMsg = '';

    console.log('Generating new QR code...');

    this.whatsappService.generateQR().subscribe({
      next: (response: any) => {
        console.log('Generate QR response:', response);
        this.isGeneratingQR = false;

        if (response.success) {
          // Limpiar estado anterior
          this.qrData = null;
          this.isConnected = false;
          this.needsQR = true;

          // Reiniciar el polling del QR
          if (this.qrCheckSubscription) {
            this.qrCheckSubscription.unsubscribe();
          }
          this.startQrPolling();

          console.log('QR generation started, polling for QR code...');

          this.errorMsg = '';
        } else {
          this.errorMsg = response.message;
          this.isGeneratingQR = false;
        }
      },
      error: (error: any) => {
        console.error('Error al generar QR:', error);
        this.errorMsg = 'Error al generar QR: ' + error.message;
        this.isGeneratingQR = false;
      }
    });
  }
}