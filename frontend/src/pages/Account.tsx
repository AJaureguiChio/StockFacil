import { AccountView } from '@neondatabase/auth-ui';
import { useParams } from 'react-router';

export default function Account() {
    const { pathname } = useParams();
    return (
        <>
            <div className="flex min-h-screen items-center justify-center p-6">
                <AccountView pathname={pathname} />
            </div>
        </>
    );
}