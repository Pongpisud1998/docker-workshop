import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    // For Docker setup with Nginx reverse proxy:
    // Browser -> /api/ -> Nginx -> NodeAPI
    private apiUrl = '/api';

    constructor(private http: HttpClient) { }

    login(credentials: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/login`, credentials);
    }

    logout(): void {
        localStorage.removeItem('user');
        // Redirect logic should be handled by component or router
    }

    getCurrentUser(): any {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    }

    uploadProfile(userId: number, file: File): Observable<any> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post(`${this.apiUrl}/upload/${userId}`, formData);
    }
}
