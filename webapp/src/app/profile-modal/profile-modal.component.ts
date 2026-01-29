import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-profile-modal',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="modal-overlay" (click)="close()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <header class="modal-header">
          <h2>User Profile</h2>
          <button class="close-btn" (click)="close()">&times;</button>
        </header>
        <div class="modal-body">
          <div class="profile-image-section">
             <img [src]="user?.image || 'assets/default-profile.png'" alt="Profile Image" class="profile-image">
          </div>
          <div class="user-info">
             <p><strong>Username:</strong> {{ user?.username }}</p>
             <p><strong>ID:</strong> {{ user?.id }}</p>
          </div>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 2000;
      display: flex;
      justify-content: center;
      align-items: center;
      backdrop-filter: blur(5px);
    }
    .modal-content {
      background: white;
      padding: 20px;
      border-radius: 10px;
      width: 400px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.3);
      animation: slideIn 0.3s ease-out;
    }
    @keyframes slideIn {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
    }
    .close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #777;
    }
    .profile-image-section {
      text-align: center;
      margin-bottom: 20px;
    }
    .profile-image {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      object-fit: cover;
      border: 3px solid #667eea;
    }
    .user-info p {
      margin: 10px 0;
      font-size: 1.1rem;
      color: #333;
    }
  `]
})
export class ProfileModalComponent {
    @Input() user: any;
    @Output() closeEvent = new EventEmitter<void>();

    close() {
        this.closeEvent.emit();
    }
}
