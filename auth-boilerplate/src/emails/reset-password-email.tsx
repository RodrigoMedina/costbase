import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "@react-email/components";

export interface ResetPasswordEmailProps {
  email: string;
  userName?: string;
  resetUrl: string;
  baseUrl?: string;
}

export const ResetPasswordEmail = ({
  userName,
  resetUrl,
}: ResetPasswordEmailProps) => {
  const firstName = userName?.trim().split(" ")[0];
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";

  return (
    <Html lang="en">
      <Head />
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="bg-[#F9F9F9] font-sans">
          <Preview>Reset your password</Preview>
          <Container className="max-w-[580px] my-[30px] mx-auto bg-white">
            <Section className="pt-[5px] px-5 pb-[10px]">
              <Text className="text-[14px] leading-[1.5]">{greeting}</Text>
              <Text className="text-[14px] leading-[1.5]">
                We received a request to reset your password. Click below to create a new one:
              </Text>
              <Button
                href={resetUrl}
                className="text-[14px] bg-[#007cba] text-white leading-normal rounded-lg py-3 px-6 box-border block text-center no-underline"
              >
                Reset Password
              </Button>
              <Text className="text-[14px] leading-[1.5] mt-4">
                If the button doesn&apos;t work, copy and paste this link:
                <br />
                <Link href={resetUrl} className="text-[#007cba] underline break-all">
                  {resetUrl}
                </Link>
              </Text>
              <Text className="text-[14px] leading-[1.5]">
                If you didn&apos;t request a password reset, you can safely ignore this email.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default ResetPasswordEmail;
