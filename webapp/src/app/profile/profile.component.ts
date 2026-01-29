import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './profile.component.html',
    styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
    user: any = null;
    selectedFile: File | null = null;
    uploadMessage: string = '';

    constructor(
        private authService: AuthService,
        private router: Router
    ) { }

    ngOnInit() {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            this.user = JSON.parse(userStr);
        } else {
            this.router.navigate(['/login']);
        }
    }

    onFileSelected(event: any) {
        this.selectedFile = event.target.files[0];
    }

    onUpload() {
        if (this.selectedFile && this.user) {
            this.authService.uploadProfile(this.user.id, this.selectedFile).subscribe({
                next: (res) => {
                    if (res.success) {
                        this.user.image = res.imageUrl;
                        localStorage.setItem('user', JSON.stringify(this.user)); // Update local storage
                        this.uploadMessage = 'Upload successful!';
                    }
                },
                error: (err) => {
                    this.uploadMessage = 'Upload failed.';
                    console.error(err);
                }
            });
        }
    }

    logout() {
        localStorage.removeItem('user');
        this.router.navigate(['/login']);
    }
}
