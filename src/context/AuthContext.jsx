import { createContext, useContext, useState, useEffect } from "react";
import { mockApi } from "../mock-api/client";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            try {
                // Try to restore session
                const userProfile = await mockApi.getUserProfile();
                setUser(userProfile);
            } catch (error) {
                // Not logged in or session expired
                console.log("No active session");
            } finally {
                setLoading(false);
            }
        };
        initAuth();
    }, []);

    const login = async (username) => {
        setLoading(true);
        try {
            const userData = await mockApi.login(username);
            setUser(userData);
            return userData;
        } catch (error) {
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        await mockApi.logout();
        setUser(null);
    };

    const refreshProfile = async () => {
        if (!user) return;
        try {
            const updatedUser = await mockApi.getUserProfile();
            setUser(updatedUser);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, refreshProfile, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
