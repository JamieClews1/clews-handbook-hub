import { AdminPageLayout } from "@/components/AdminPageLayout";
import { ProjectionsDashboard } from "@/components/projections/ProjectionsDashboard";

const ProjectionsPage = () => {
  return (
    <AdminPageLayout>
      <ProjectionsDashboard />
    </AdminPageLayout>
  );
};

export default ProjectionsPage;
