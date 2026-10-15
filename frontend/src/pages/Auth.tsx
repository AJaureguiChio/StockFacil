import { AuthView } from '@neondatabase/auth-ui';
import { useParams } from 'react-router';

export default function Auth() {
    const { pathname } = useParams();
    return (
        <div className="flex min-h-screen items-center justify-center p-6">
            <AuthView pathname={pathname} />
        </div>
    );
}