import { AppDataSource } from '../database/data-source';
import { User } from '../entities/User.entity';
import { AuthService } from './auth.service';
import { SkillLevel } from '../entities/enums';

export interface CreateUserData {
  email: string;
  username: string;
  password: string;
  fullName?: string;
  bio?: string;
  skillLevel?: SkillLevel;
}

export class UserService {
  private static userRepository = AppDataSource.getRepository(User);

  static async createUser(data: CreateUserData): Promise<User> {
    const hashedPassword = await AuthService.hashPassword(data.password);

    const user = this.userRepository.create({
      email: data.email,
      username: data.username,
      password: hashedPassword,
      fullName: data.fullName || null,
      bio: data.bio || null,
      skillLevel: data.skillLevel || SkillLevel.BEGINNER,
    });

    return await this.userRepository.save(user);
  }

  static async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  static async findByUsername(username: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { username } });
  }

  static async findById(id: number): Promise<User | null> {
    return await this.userRepository.findOne({ where: { id } });
  }

  static async findByEmailOrUsername(emailOrUsername: string): Promise<User | null> {
    return await this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :emailOrUsername OR user.username = :emailOrUsername', { emailOrUsername })
      .getOne();
  }
}
